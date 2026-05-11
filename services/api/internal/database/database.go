package database

import (
	"context"
	"database/sql"
	"errors"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Open 创建 GORM 数据库连接。
// 这里要求 DATABASE_URL 必须显式配置，避免 API 在没有数据库的情况下静默启动。
func Open(databaseURL string) (*gorm.DB, error) {
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	return gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
}

// SQLDB 取出 GORM 底层的 *sql.DB。
// GORM 负责 ORM 操作，底层 *sql.DB 负责连接池、Ping、Close 等通用数据库能力。
func SQLDB(db *gorm.DB) (*sql.DB, error) {
	if db == nil {
		return nil, errors.New("database is nil")
	}

	return db.DB()
}

// Ping 用于验证数据库连接是否可用。
// API 启动和 /health 都会调用它，让数据库故障可以尽早暴露。
func Ping(ctx context.Context, db *gorm.DB) error {
	sqlDB, err := SQLDB(db)
	if err != nil {
		return err
	}

	return sqlDB.PingContext(ctx)
}
