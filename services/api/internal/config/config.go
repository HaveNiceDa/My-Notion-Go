package config

import "os"

// Config 是 API 服务启动所需的运行时配置。
// 当前从环境变量读取，后续如果配置项变多，可以再引入更完整的配置库。
type Config struct {
	Env                string
	HTTPAddr           string
	DatabaseURL        string
	JWTAccessSecret    string
	JWTRefreshSecret   string
	AccessTokenMinutes int
	RefreshTokenDays   int
}

// Load 读取环境变量并填充默认值。
// DATABASE_URL 不设置默认值，数据库连接必须显式配置，避免误连错误环境。
func Load() Config {
	return Config{
		Env:                getEnv("APP_ENV", "development"),
		HTTPAddr:           getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTAccessSecret:    getEnv("JWT_ACCESS_SECRET", "change-me-access-secret"),
		JWTRefreshSecret:   getEnv("JWT_REFRESH_SECRET", "change-me-refresh-secret"),
		AccessTokenMinutes: 15,
		RefreshTokenDays:   30,
	}
}

// getEnv 读取环境变量；为空时返回 fallback。
func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
