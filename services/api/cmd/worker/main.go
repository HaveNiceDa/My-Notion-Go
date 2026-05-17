package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/ai"
	"github.com/bytel/my-notion-go/services/api/internal/config"
	"github.com/bytel/my-notion-go/services/api/internal/database"
	"github.com/bytel/my-notion-go/services/api/internal/documents"
	"github.com/bytel/my-notion-go/services/api/internal/jobs"
	"github.com/bytel/my-notion-go/services/api/internal/rag"
	"github.com/joho/godotenv"
)

func main() {
	// worker 与 API 使用同一份 .env，便于本地同时启动两个进程。
	_ = godotenv.Load()

	cfg := config.Load()
	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	sqlDB, err := database.SQLDB(db)
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := database.Ping(ctx, db); err != nil {
		cancel()
		log.Fatalf("database ping failed: %v", err)
	}
	cancel()

	embeddingClient := ai.NewEmbeddingClient(ai.EmbeddingConfig{
		APIKey:  cfg.DashScopeAPIKey,
		BaseURL: cfg.DashScopeAPIBaseURL,
	})
	if embeddingClient.Enabled() {
		log.Printf("embedding client configured with model %s and dimension %d", ai.DefaultEmbeddingModelID, ai.DefaultEmbeddingDimension)
	} else {
		log.Print("embedding client disabled: missing DASHSCOPE_API_KEY/LLM_API_KEY or DASHSCOPE_API_BASE_URL")
	}

	qdrantClient := rag.NewQdrantClient(rag.QdrantConfig{
		BaseURL: cfg.QdrantURL,
		APIKey:  cfg.QdrantAPIKey,
	})
	initializeQdrant(qdrantClient, cfg.QdrantCollection, ai.DefaultEmbeddingDimension)

	documentRepo := documents.NewRepository(db)
	ragRepo := rag.NewRepository(db)
	jobRepo := jobs.NewRepository(db)
	ragService := rag.NewService(ragRepo, documentRepo, nil, embeddingClient, qdrantClient, cfg.QdrantCollection)
	ragService.SetJobRepository(jobRepo)

	worker := rag.NewIndexWorker(jobRepo, ragService, 2*time.Second)
	runCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Println("my-notion-go worker started")
	if err := worker.Run(runCtx); err != nil && err != context.Canceled {
		log.Fatalf("worker stopped: %v", err)
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
