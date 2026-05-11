package main

import (
	"context"
	"flag"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/config"
	"github.com/bytel/my-notion-go/services/api/internal/database"
	"github.com/joho/godotenv"
)

func main() {
	// 允许本地开发直接从 .env 读取 DATABASE_URL。
	// 如果 .env 不存在也不报错，线上环境可以直接通过环境变量注入。
	_ = godotenv.Load()

	// -dir 方便以后在不同工作目录下执行迁移；-timeout 防止迁移卡死。
	dir := flag.String("dir", defaultMigrationsDir(), "directory containing SQL migration files")
	timeout := flag.Duration("timeout", 30*time.Second, "migration timeout")
	flag.Parse()

	// 当前第一阶段只实现 up，后续需要时再补 down/status。
	action := "up"
	if flag.NArg() > 0 {
		action = flag.Arg(0)
	}

	if action != "up" {
		log.Fatalf("unsupported migration action %q, only up is supported", action)
	}

	cfg := config.Load()
	// 迁移命令和 API 共用同一个 database.Open，保证连接行为一致。
	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}

	sqlDB, err := database.SQLDB(db)
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	// 所有数据库操作都绑定超时，避免数据库不可达时命令长时间挂起。
	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	if err := database.Ping(ctx, db); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}

	// NewMigrator 会跳过已经执行过的版本，所以重复运行是安全的。
	applied, err := database.NewMigrator(db, *dir).Up(ctx)
	if err != nil {
		log.Fatal(err)
	}

	if len(applied) == 0 {
		log.Println("database schema is already up to date")
		return
	}

	for _, migration := range applied {
		log.Printf("applied migration %s (%s)", migration.Version, migration.Name)
	}
}

// defaultMigrationsDir 兼容两种运行位置：
// 1. 从仓库根目录运行：services/api/migrations
// 2. 从 services/api 目录运行：migrations
func defaultMigrationsDir() string {
	candidates := []string{
		filepath.Join("services", "api", "migrations"),
		"migrations",
	}

	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}

	return candidates[0]
}
