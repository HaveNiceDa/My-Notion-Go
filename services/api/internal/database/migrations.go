package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// Migration 表示一个待执行或已执行的 SQL 迁移文件。
// Version 来自文件名，例如 000001_initial_schema；Name 用于日志展示。
type Migration struct {
	Version string
	Name    string
	Path    string
}

// Migrator 是一个轻量级 migration runner。
// 它只负责执行 *.up.sql，并通过 schema_migrations 表记录执行历史。
type Migrator struct {
	db  *gorm.DB
	dir string
}

// NewMigrator 创建迁移执行器。
// dir 通常是 services/api/migrations，里面放按版本号排序的 SQL 文件。
func NewMigrator(db *gorm.DB, dir string) *Migrator {
	return &Migrator{db: db, dir: dir}
}

// Up 执行所有尚未应用的 up migration。
// 这个方法是幂等的：已经记录在 schema_migrations 里的版本会被跳过。
func (m *Migrator) Up(ctx context.Context) ([]Migration, error) {
	if m.db == nil {
		return nil, errors.New("database is nil")
	}

	if m.dir == "" {
		return nil, errors.New("migration directory is required")
	}

	if err := m.ensureSchemaMigrations(ctx); err != nil {
		return nil, err
	}

	// 通过文件名排序保证迁移按版本顺序执行：000001 -> 000002 -> ...
	files, err := filepath.Glob(filepath.Join(m.dir, "*.up.sql"))
	if err != nil {
		return nil, err
	}
	sort.Strings(files)

	applied, err := m.appliedVersions(ctx)
	if err != nil {
		return nil, err
	}

	var completed []Migration
	for _, file := range files {
		migration := parseMigration(file)
		// 已执行的版本直接跳过，所以重复运行 pnpm migrate:api 是安全的。
		if applied[migration.Version] {
			continue
		}

		if err := m.applyFile(ctx, migration); err != nil {
			return completed, err
		}
		completed = append(completed, migration)
	}

	return completed, nil
}

// ensureSchemaMigrations 创建迁移历史表。
// 这张表是 migration 系统自己的元数据表，不属于业务数据。
func (m *Migrator) ensureSchemaMigrations(ctx context.Context) error {
	return m.db.WithContext(ctx).Exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`).Error
}

// appliedVersions 读取已经成功执行过的 migration 版本。
// 返回 map 是为了后续 O(1) 判断某个版本是否已经应用。
func (m *Migrator) appliedVersions(ctx context.Context) (map[string]bool, error) {
	rows, err := m.db.WithContext(ctx).Raw("SELECT version FROM schema_migrations").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

// applyFile 在一个事务中执行单个 SQL 文件并记录版本。
// 如果 SQL 执行失败，事务会回滚，schema_migrations 也不会留下半成功记录。
func (m *Migrator) applyFile(ctx context.Context, migration Migration) error {
	content, err := os.ReadFile(migration.Path)
	if err != nil {
		return err
	}

	tx := m.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Exec(string(content)).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("apply migration %s: %w", migration.Version, err)
	}

	if err := tx.Exec(
		"INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
		migration.Version,
		migration.Name,
	).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("record migration %s: %w", migration.Version, err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("commit migration %s: %w", migration.Version, err)
	}

	return nil
}

// parseMigration 从文件路径解析 migration 元信息。
// 例如 000001_initial_schema.up.sql 会得到 Version=000001_initial_schema。
func parseMigration(path string) Migration {
	base := filepath.Base(path)
	version := strings.TrimSuffix(base, ".up.sql")
	name := version
	if index := strings.Index(version, "_"); index >= 0 && index+1 < len(version) {
		name = version[index+1:]
	}

	return Migration{
		Version: version,
		Name:    name,
		Path:    path,
	}
}
