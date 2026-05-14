package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/config"
	"github.com/bytel/my-notion-go/services/api/internal/database"
	"github.com/bytel/my-notion-go/services/api/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 本地开发读取 .env；生产环境通常直接使用系统环境变量。
	_ = godotenv.Load()

	cfg := config.Load()
	// API 启动时就连接数据库。如果 DATABASE_URL 缺失或数据库不可用，服务直接启动失败。
	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}

	sqlDB, err := database.SQLDB(db)
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	// 启动阶段做一次数据库探活，避免“API 已启动但核心依赖不可用”的假健康状态。
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := database.Ping(ctx, db); err != nil {
		cancel()
		log.Fatalf("database ping failed: %v", err)
	}
	cancel()

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	router.GET("/health", func(c *gin.Context) {
		// 每次 health check 都重新 ping 数据库，用于给 Docker、负载均衡或部署平台判断服务状态。
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		databaseStatus := "ok"
		statusCode := http.StatusOK
		if err := database.Ping(ctx, db); err != nil {
			databaseStatus = "down"
			statusCode = http.StatusServiceUnavailable
		}

		c.JSON(statusCode, gin.H{
			"status":   databaseStatus,
			"service":  "my-notion-go-api",
			"database": databaseStatus,
		})
	})

	api := router.Group("/api/v1")
	api.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	// Auth 模块依赖顺序：TokenManager -> Repository -> Service -> Handler。
	// 这样 main.go 只负责装配依赖，具体业务规则仍然保留在 internal/auth 内部。
	tokenManager := auth.NewTokenManager(
		cfg.JWTAccessSecret,
		time.Duration(cfg.AccessTokenMinutes)*time.Minute,
	)
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(
		authRepo,
		tokenManager,
		cfg.JWTRefreshSecret,
		time.Duration(cfg.RefreshTokenDays)*24*time.Hour,
	)
	authHandler := auth.NewHandler(authService)

	// 公开 Auth 接口：注册、登录、刷新 token、退出登录。
	authRoutes := api.Group("/auth")
	authRoutes.POST("/register", authHandler.Register)
	authRoutes.POST("/login", authHandler.Login)
	authRoutes.POST("/refresh", authHandler.Refresh)
	authRoutes.POST("/logout", authHandler.Logout)

	// /me 是受保护接口，必须先通过 RequireAuth 解析 Bearer token。
	api.GET("/me", middleware.RequireAuth(tokenManager), authHandler.Me)

	if err := router.Run(cfg.HTTPAddr); err != nil {
		panic(err)
	}
}
