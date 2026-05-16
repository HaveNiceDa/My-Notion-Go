package rag

import "time"

const (
	StatusPending  = "pending"
	StatusIndexing = "indexing"
	StatusIndexed  = "indexed"
	StatusFailed   = "failed"
	StatusDisabled = "disabled"
)

// Document 保存单篇文档的 RAG 索引状态。
// documents.is_in_knowledge_base 表达产品开关；rag_documents.status 表达索引任务状态。
type Document struct {
	ID          string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID      string     `gorm:"type:uuid;not null;index"`
	DocumentID  string     `gorm:"type:uuid;not null;index"`
	Status      string     `gorm:"not null;default:'pending'"`
	ContentHash string     `gorm:"not null;default:''"`
	ChunkCount  int        `gorm:"not null;default:0"`
	LastError   string     `gorm:"not null;default:''"`
	IndexedAt   *time.Time `gorm:"type:timestamptz"`
	CreatedAt   time.Time  `gorm:"not null"`
	UpdatedAt   time.Time  `gorm:"not null"`
}

func (Document) TableName() string {
	return "rag_documents"
}

type Chunk struct {
	ID            string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID        string    `gorm:"type:uuid;not null;index"`
	DocumentID    string    `gorm:"type:uuid;not null;index"`
	RAGDocumentID string    `gorm:"type:uuid;not null;index"`
	QdrantPointID string    `gorm:"not null;default:''"`
	Content       string    `gorm:"not null;default:''"`
	BlockIDs      []byte    `gorm:"type:jsonb;not null;default:'[]'::jsonb"`
	Position      int       `gorm:"not null;default:0"`
	TokenCount    int       `gorm:"not null;default:0"`
	Metadata      []byte    `gorm:"type:jsonb;not null;default:'{}'::jsonb"`
	CreatedAt     time.Time `gorm:"not null"`
	UpdatedAt     time.Time `gorm:"not null"`
}

func (Chunk) TableName() string {
	return "rag_chunks"
}

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

type DocumentStatusDTO struct {
	DocumentID        string     `json:"documentId"`
	IsInKnowledgeBase bool       `json:"isInKnowledgeBase"`
	Status            string     `json:"status"`
	ChunkCount        int        `json:"chunkCount"`
	LastError         string     `json:"lastError"`
	IndexedAt         *time.Time `json:"indexedAt"`
	UpdatedAt         *time.Time `json:"updatedAt"`
}

type CitationDTO struct {
	ChunkID    string  `json:"chunkId"`
	DocumentID string  `json:"documentId"`
	Position   int     `json:"position"`
	Score      float64 `json:"score"`
	Preview    string  `json:"preview"`
}

type ChatMetadataDTO struct {
	Enabled   bool          `json:"enabled"`
	Fallback  bool          `json:"fallback"`
	Reason    string        `json:"reason,omitempty"`
	Citations []CitationDTO `json:"citations"`
}

func NewDocumentStatusDTO(documentID string, inKnowledgeBase bool, ragDocument *Document) DocumentStatusDTO {
	if ragDocument == nil {
		status := StatusDisabled
		if inKnowledgeBase {
			status = StatusPending
		}
		return DocumentStatusDTO{
			DocumentID:        documentID,
			IsInKnowledgeBase: inKnowledgeBase,
			Status:            status,
		}
	}

	return DocumentStatusDTO{
		DocumentID:        documentID,
		IsInKnowledgeBase: inKnowledgeBase,
		Status:            ragDocument.Status,
		ChunkCount:        ragDocument.ChunkCount,
		LastError:         ragDocument.LastError,
		IndexedAt:         ragDocument.IndexedAt,
		UpdatedAt:         &ragDocument.UpdatedAt,
	}
}
