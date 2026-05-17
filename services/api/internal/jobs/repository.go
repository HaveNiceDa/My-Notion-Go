package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

var ErrNoPendingJob = errors.New("no pending job")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// EnqueueRAGIndex 对同一用户同一文档做 pending 合并，避免 autosave 高频触发重复向量化。
// running 任务不复用：如果用户在索引执行期间继续保存正文，需要额外保留一条 pending 任务处理最新内容。
func (r *Repository) EnqueueRAGIndex(ctx context.Context, userID string, documentID string, reason string) (Job, error) {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	reason = strings.TrimSpace(reason)
	if reason == "" {
		reason = "manual"
	}

	var existing Job
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND type = ? AND status = ?", userID, TypeRAGIndex, StatusPending).
		Where("payload->>'documentId' = ?", documentID).
		Order("created_at DESC").
		Limit(1).
		Find(&existing).
		Error
	if err != nil {
		return Job{}, err
	}
	if existing.ID != "" {
		return existing, nil
	}

	payload, err := json.Marshal(map[string]any{
		"documentId": documentID,
		"reason":     reason,
	})
	if err != nil {
		return Job{}, err
	}

	job := Job{
		UserID:  userID,
		Type:    TypeRAGIndex,
		Status:  StatusPending,
		Payload: payload,
		Result:  []byte("{}"),
	}
	if err := r.db.WithContext(ctx).Create(&job).Error; err != nil {
		return Job{}, err
	}
	return job, nil
}

// ClaimNext 用数据库行锁领取任务。
// FOR UPDATE SKIP LOCKED 允许多个 worker 并发轮询，不会同时处理同一条 pending job。
func (r *Repository) ClaimNext(ctx context.Context, jobType string) (Job, error) {
	var claimed Job
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job Job
		if err := tx.Raw(`
SELECT id, user_id, type, status, payload, result, last_error, finished_at, created_at, updated_at
FROM jobs
WHERE type = ? AND status = ?
ORDER BY created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;
`, jobType, StatusPending).Scan(&job).Error; err != nil {
			return err
		}
		if job.ID == "" {
			return ErrNoPendingJob
		}

		if err := tx.Model(&Job{}).
			Where("id = ?", job.ID).
			Updates(map[string]any{
				"status":      StatusRunning,
				"last_error":  "",
				"finished_at": nil,
				"updated_at":  time.Now(),
			}).
			Error; err != nil {
			return err
		}
		job.Status = StatusRunning
		job.LastError = ""
		job.FinishedAt = nil
		job.UpdatedAt = time.Now()
		claimed = job
		return nil
	})
	if err != nil {
		return Job{}, err
	}
	return claimed, nil
}

func (r *Repository) MarkCompleted(ctx context.Context, jobID string, result []byte) error {
	if len(result) == 0 {
		result = []byte("{}")
	}
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&Job{}).
		Where("id = ?", strings.TrimSpace(jobID)).
		Updates(map[string]any{
			"status":      StatusCompleted,
			"result":      result,
			"last_error":  "",
			"finished_at": now,
			"updated_at":  now,
		}).
		Error
}

func (r *Repository) MarkFailed(ctx context.Context, jobID string, message string) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&Job{}).
		Where("id = ?", strings.TrimSpace(jobID)).
		Updates(map[string]any{
			"status":      StatusFailed,
			"last_error":  strings.TrimSpace(message),
			"finished_at": now,
			"updated_at":  now,
		}).
		Error
}
