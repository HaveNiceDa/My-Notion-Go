package jobs

import "time"

const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"

	TypeRAGIndex = "rag.index"
)

// Job 是通用异步任务记录。
// PostgreSQL 是任务最终状态来源，后续接 RabbitMQ 时也继续以这张表做审计和失败追踪。
type Job struct {
	ID         string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID     string     `gorm:"type:uuid;not null;index"`
	Type       string     `gorm:"not null"`
	Status     string     `gorm:"not null;default:'pending'"`
	Payload    []byte     `gorm:"type:jsonb;not null;default:'{}'::jsonb"`
	Result     []byte     `gorm:"type:jsonb;not null;default:'{}'::jsonb"`
	LastError  string     `gorm:"not null;default:''"`
	FinishedAt *time.Time `gorm:"type:timestamptz"`
	CreatedAt  time.Time  `gorm:"not null"`
	UpdatedAt  time.Time  `gorm:"not null"`
}

func (Job) TableName() string {
	return "jobs"
}
