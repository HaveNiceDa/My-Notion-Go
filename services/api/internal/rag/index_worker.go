package rag

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/jobs"
)

const defaultIndexWorkerPollInterval = 2 * time.Second

type IndexWorker struct {
	jobRepo      *jobs.Repository
	ragService   *Service
	pollInterval time.Duration
}

func NewIndexWorker(jobRepo *jobs.Repository, ragService *Service, pollInterval time.Duration) *IndexWorker {
	if pollInterval <= 0 {
		pollInterval = defaultIndexWorkerPollInterval
	}
	return &IndexWorker{
		jobRepo:      jobRepo,
		ragService:   ragService,
		pollInterval: pollInterval,
	}
}

type indexJobPayload struct {
	DocumentID string `json:"documentId"`
	Reason     string `json:"reason"`
}

// Run 使用 DB polling 消费 RAG 索引任务。
// 这里先不引入 RabbitMQ 客户端依赖，保持 worker 编排清晰；后续可把 ClaimNext 替换为消息消费。
func (w *IndexWorker) Run(ctx context.Context) error {
	if w.jobRepo == nil || w.ragService == nil {
		return errors.New("rag index worker is not configured")
	}

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		processed, err := w.ProcessNext(ctx)
		if err != nil && !errors.Is(err, jobs.ErrNoPendingJob) {
			log.Printf("rag index worker process failed: %v", err)
		}
		if processed {
			continue
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (w *IndexWorker) ProcessNext(ctx context.Context) (bool, error) {
	job, err := w.jobRepo.ClaimNext(ctx, jobs.TypeRAGIndex)
	if errors.Is(err, jobs.ErrNoPendingJob) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	var payload indexJobPayload
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		_ = w.jobRepo.MarkFailed(ctx, job.ID, err.Error())
		return true, err
	}
	if payload.DocumentID == "" {
		err := errors.New("rag index job missing documentId")
		_ = w.jobRepo.MarkFailed(ctx, job.ID, err.Error())
		return true, err
	}

	indexed, err := w.ragService.ExecuteIndexJob(ctx, job.UserID, payload.DocumentID)
	if err != nil {
		_ = w.jobRepo.MarkFailed(ctx, job.ID, err.Error())
		return true, err
	}

	result, err := json.Marshal(map[string]any{
		"documentId": indexed.DocumentID,
		"status":     indexed.Status,
		"chunkCount": indexed.ChunkCount,
		"indexedAt":  indexed.IndexedAt,
	})
	if err != nil {
		_ = w.jobRepo.MarkFailed(ctx, job.ID, err.Error())
		return true, err
	}
	if err := w.jobRepo.MarkCompleted(ctx, job.ID, result); err != nil {
		return true, err
	}
	return true, nil
}
