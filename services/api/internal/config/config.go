package config

import (
	"os"
	"strings"
)

// Config 是 API 服务启动所需的运行时配置。
// 当前从环境变量读取，后续如果配置项变多，可以再引入更完整的配置库。
type Config struct {
	Env                 string
	HTTPAddr            string
	DatabaseURL         string
	CORSAllowedOrigins  []string
	JWTAccessSecret     string
	JWTRefreshSecret    string
	AccessTokenMinutes  int
	RefreshTokenDays    int
	LLMAPIKey           string
	LLMBaseURL          string
	DashScopeAPIKey     string
	DashScopeAPIBaseURL string
	QdrantURL           string
	QdrantAPIKey        string
	QdrantCollection    string
}

// Load 读取环境变量并填充默认值。
// DATABASE_URL 不设置默认值，数据库连接必须显式配置，避免误连错误环境。
func Load() Config {
	return Config{
		Env:                 getEnv("APP_ENV", "development"),
		HTTPAddr:            getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		CORSAllowedOrigins:  getCSVEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5273"),
		JWTAccessSecret:     getEnv("JWT_ACCESS_SECRET", "change-me-access-secret"),
		JWTRefreshSecret:    getEnv("JWT_REFRESH_SECRET", "change-me-refresh-secret"),
		AccessTokenMinutes:  15,
		RefreshTokenDays:    30,
		LLMAPIKey:           firstNonEmptyEnv("LLM_API_KEY", "OPENAI_API_KEY", "DASHSCOPE_API_KEY"),
		LLMBaseURL:          firstNonEmptyEnvWithFallback("https://dashscope.aliyuncs.com/compatible-mode/v1", "LLM_BASE_URL", "OPENAI_BASE_URL"),
		DashScopeAPIKey:     firstNonEmptyEnv("DASHSCOPE_API_KEY", "LLM_API_KEY"),
		DashScopeAPIBaseURL: firstNonEmptyEnvWithFallback("https://dashscope.aliyuncs.com/api/v1", "DASHSCOPE_API_BASE_URL"),
		QdrantURL:           getEnv("QDRANT_URL", "http://localhost:6333"),
		QdrantAPIKey:        os.Getenv("QDRANT_API_KEY"),
		QdrantCollection:    getEnv("QDRANT_COLLECTION", "my_notion_go_chunks"),
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

// getCSVEnv 读取逗号分隔配置，适合 CORS origins 这类需要显式白名单的列表型配置。
func getCSVEnv(key string, fallback string) []string {
	rawValue := getEnv(key, fallback)
	parts := strings.Split(rawValue, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value != "" {
			values = append(values, value)
		}
	}
	return values
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func firstNonEmptyEnvWithFallback(fallback string, keys ...string) string {
	if value := firstNonEmptyEnv(keys...); value != "" {
		return value
	}
	return fallback
}
