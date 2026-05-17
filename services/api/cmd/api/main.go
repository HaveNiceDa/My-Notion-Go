package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/ai"
	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/chat"
	"github.com/bytel/my-notion-go/services/api/internal/config"
	"github.com/bytel/my-notion-go/services/api/internal/database"
	"github.com/bytel/my-notion-go/services/api/internal/documents"
	"github.com/bytel/my-notion-go/services/api/internal/jobs"
	"github.com/bytel/my-notion-go/services/api/internal/middleware"
	"github.com/bytel/my-notion-go/services/api/internal/rag"
	"github.com/bytel/my-notion-go/services/api/internal/realtime"
	"github.com/gin-contrib/cors"
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
	// 本地开发不经过反向代理，显式禁用可信代理列表，避免 Gin 默认信任所有代理。
	if err := router.SetTrustedProxies(nil); err != nil {
		log.Fatalf("set trusted proxies failed: %v", err)
	}
	// CORS 必须在业务路由前注册，让浏览器的 OPTIONS 预检请求能先拿到跨域响应头。
	// 默认只允许本地 Web 开发端口 5273，后续部署环境通过 CORS_ALLOWED_ORIGINS 显式扩展白名单。
	router.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSAllowedOrigins,
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			"Authorization",
			"Content-Type",
			"Origin",
		},
		ExposeHeaders: []string{
			"Content-Length",
		},
		MaxAge: 12 * time.Hour,
	}))
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
	realtimeHub := realtime.NewHub()
	realtimeHandler := realtime.NewHandler(realtimeHub)
	documentRepo := documents.NewRepository(db)
	documentService := documents.NewService(documentRepo)
	documentService.SetEventPublisher(realtimeHub)
	documentHandler := documents.NewHandler(documentService)
	chatRepo := chat.NewRepository(db)
	aiClient := ai.NewClient(ai.Config{
		APIKey:  cfg.LLMAPIKey,
		BaseURL: cfg.LLMBaseURL,
	})
	embeddingClient := ai.NewEmbeddingClient(ai.EmbeddingConfig{
		APIKey:  cfg.DashScopeAPIKey,
		BaseURL: cfg.DashScopeAPIBaseURL,
	})
	// AI Chat 使用 OpenAI Compatible SSE；Embedding 使用 DashScope 原生多模态 API。
	// 两条链路分开配置，避免把 /chat/completions 和多模态 embedding 的协议格式混用。
	if embeddingClient.Enabled() {
		log.Printf("embedding client configured with model %s and dimension %d", ai.DefaultEmbeddingModelID, ai.DefaultEmbeddingDimension)
	} else {
		log.Print("embedding client disabled: missing DASHSCOPE_API_KEY/LLM_API_KEY or DASHSCOPE_API_BASE_URL")
	}
	qdrantClient := rag.NewQdrantClient(rag.QdrantConfig{
		BaseURL: cfg.QdrantURL,
		APIKey:  cfg.QdrantAPIKey,
	})
	// Qdrant 属于 M5 RAG 能力，当前不作为 Auth/Document/AI Chat 的强依赖。
	// 本地没有启动 Qdrant 时仅记录 warning，后续真正调用 RAG API 时再返回明确业务错误。
	initializeQdrant(qdrantClient, cfg.QdrantCollection, ai.DefaultEmbeddingDimension)
	chatService := chat.NewService(chatRepo, aiClient)
	chatHandler := chat.NewHandler(chatService)
	ragRepo := rag.NewRepository(db)
	jobRepo := jobs.NewRepository(db)
	ragService := rag.NewService(ragRepo, documentRepo, chatService, embeddingClient, qdrantClient, cfg.QdrantCollection)
	ragService.SetJobRepository(jobRepo)
	ragHandler := rag.NewHandler(ragService)
	documentService.SetContentUpdatedHook(ragService.ReindexDocumentIfEnabled)

	// 公开 Auth 接口：注册、登录、刷新 token、退出登录。
	authRoutes := api.Group("/auth")
	authRoutes.POST("/register", authHandler.Register)
	authRoutes.POST("/login", authHandler.Login)
	authRoutes.POST("/refresh", authHandler.Refresh)
	authRoutes.POST("/logout", authHandler.Logout)

	// /me 是受保护接口，必须先通过 RequireAuth 解析 Bearer token。
	api.GET("/me", middleware.RequireAuth(tokenManager), authHandler.Me)

	// Public 接口不要求登录，但只返回显式发布的只读文档。
	publicRoutes := api.Group("/public")
	publicRoutes.GET("/documents/:publicId", documentHandler.GetPublished)

	// Document 接口全部要求登录，Service 层会继续按 user_id 做数据归属隔离。
	documentRoutes := api.Group("/documents", middleware.RequireAuth(tokenManager))
	documentRoutes.POST("", documentHandler.Create)
	documentRoutes.GET("/search", documentHandler.Search)
	documentRoutes.GET("/tree", documentHandler.Tree)
	documentRoutes.GET("/trash", documentHandler.Trash)
	documentRoutes.PUT("/favorites/order", documentHandler.UpdateFavoritesOrder)
	documentRoutes.GET("/:id/content", documentHandler.GetContent)
	documentRoutes.PUT("/:id/content", documentHandler.UpdateContent)
	documentRoutes.GET("/:id", documentHandler.Get)
	documentRoutes.PATCH("/:id", documentHandler.Update)
	documentRoutes.POST("/:id/publish", documentHandler.Publish)
	documentRoutes.DELETE("/:id/publish", documentHandler.Unpublish)
	documentRoutes.POST("/:id/archive", documentHandler.Archive)
	documentRoutes.POST("/:id/restore", documentHandler.Restore)
	documentRoutes.DELETE("/:id", documentHandler.Delete)

	// Realtime 接口要求登录。M7.0 先使用单进程 SSE Hub，后续多实例再在 Hub 后接 Redis Pub/Sub。
	realtimeRoutes := api.Group("/realtime", middleware.RequireAuth(tokenManager))
	realtimeRoutes.GET("/events", realtimeHandler.StreamEvents)

	// RAG 接口要求登录。M5.1 先提供知识库开关和索引状态骨架，真正切块/向量化在 M5.2 接入。
	ragRoutes := api.Group("/rag", middleware.RequireAuth(tokenManager))
	ragRoutes.POST("/documents/:id/index", ragHandler.EnableDocumentIndex)
	ragRoutes.DELETE("/documents/:id/index", ragHandler.DisableDocumentIndex)
	ragRoutes.GET("/documents/:id/status", ragHandler.GetDocumentStatus)
	ragRoutes.POST("/chat/stream", ragHandler.StreamRAGChat)

	// AI Chat 接口要求登录；配置 LLM_API_KEY 后走真实 OpenAI Compatible SSE，否则保留 mock fallback。
	aiRoutes := api.Group("/ai", middleware.RequireAuth(tokenManager))
	aiRoutes.GET("/conversations", chatHandler.ListConversations)
	aiRoutes.POST("/conversations", chatHandler.CreateConversation)
	aiRoutes.GET("/conversations/:id/messages", chatHandler.ListMessages)
	aiRoutes.POST("/chat/stream", chatHandler.StreamChat)

	if err := router.Run(cfg.HTTPAddr); err != nil {
		panic(err)
	}
}

func initializeQdrant(client *rag.QdrantClient, collection string, dimension int) {
	if !client.Enabled() {
		log.Print("qdrant client disabled: missing QDRANT_URL")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Health(ctx); err != nil {
		log.Printf("qdrant health check failed: %v", err)
		return
	}
	if err := client.EnsureCollection(ctx, collection, dimension); err != nil {
		log.Printf("qdrant collection init failed: %v", err)
		return
	}
	log.Printf("qdrant collection ready: %s (dimension=%d)", collection, dimension)
}
