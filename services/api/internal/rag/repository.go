package rag

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

var ErrStatusNotFound = errors.New("rag document status not found")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// FindByDocumentID 按 user_id 和 document_id 查询 RAG 状态。
// user_id 必须参与条件，避免用户通过猜 document_id 读取别人的知识库状态。
func (r *Repository) FindByDocumentID(ctx context.Context, userID string, documentID string) (Document, error) {
	var document Document
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND document_id = ?", userID, documentID).
		First(&document).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Document{}, ErrStatusNotFound
	}
	return document, err
}

// UpsertDocumentStatus 保证“一个用户的一篇文档只有一条 RAG 状态记录”。
// POST/DELETE/首次 GET 都会复用这条路径，这样重复调用接口是幂等的。
func (r *Repository) UpsertDocumentStatus(ctx context.Context, userID string, documentID string, status string) (Document, error) {
	var document Document
	err := r.db.WithContext(ctx).Raw(`
INSERT INTO rag_documents (user_id, document_id, status, content_hash, chunk_count, last_error, indexed_at, updated_at)
VALUES (?, ?, ?, '', 0, '', NULL, NOW())
ON CONFLICT (user_id, document_id)
DO UPDATE SET
  status = EXCLUDED.status,
  content_hash = '',
  chunk_count = 0,
  last_error = '',
  indexed_at = NULL,
  updated_at = NOW()
RETURNING id, user_id, document_id, status, content_hash, chunk_count, last_error, indexed_at, created_at, updated_at;
`, userID, documentID, status).Scan(&document).Error
	return document, err
}

// MarkIndexed 预留给 M5.2/M5.3 的真实索引流程。
// 后续 chunk + Qdrant upsert 成功后，用它一次性记录内容 hash、chunk 数和 indexed_at。
func (r *Repository) MarkIndexed(ctx context.Context, userID string, documentID string, chunkCount int, contentHash string, indexedAt time.Time) (Document, error) {
	var document Document
	err := r.db.WithContext(ctx).Raw(`
INSERT INTO rag_documents (user_id, document_id, status, content_hash, chunk_count, last_error, indexed_at, updated_at)
VALUES (?, ?, ?, ?, ?, '', ?, NOW())
ON CONFLICT (user_id, document_id)
DO UPDATE SET
  status = EXCLUDED.status,
  content_hash = EXCLUDED.content_hash,
  chunk_count = EXCLUDED.chunk_count,
  last_error = '',
  indexed_at = EXCLUDED.indexed_at,
  updated_at = NOW()
RETURNING id, user_id, document_id, status, content_hash, chunk_count, last_error, indexed_at, created_at, updated_at;
`, userID, documentID, StatusIndexed, contentHash, chunkCount, indexedAt).Scan(&document).Error
	return document, err
}

func (r *Repository) MarkFailed(ctx context.Context, userID string, documentID string, message string) (Document, error) {
	var document Document
	err := r.db.WithContext(ctx).Raw(`
INSERT INTO rag_documents (user_id, document_id, status, last_error, updated_at)
VALUES (?, ?, ?, ?, NOW())
ON CONFLICT (user_id, document_id)
DO UPDATE SET
  status = EXCLUDED.status,
  last_error = EXCLUDED.last_error,
  updated_at = NOW()
RETURNING id, user_id, document_id, status, content_hash, chunk_count, last_error, indexed_at, created_at, updated_at;
`, userID, documentID, StatusFailed, message).Scan(&document).Error
	return document, err
}

func (r *Repository) CreateChunks(ctx context.Context, chunks []Chunk) error {
	if len(chunks) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&chunks).Error
}

func (r *Repository) DeleteChunksByDocumentID(ctx context.Context, userID string, documentID string) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND document_id = ?", userID, documentID).
		Delete(&Chunk{}).
		Error
}

func (r *Repository) ListPointIDsByDocumentID(ctx context.Context, userID string, documentID string) ([]string, error) {
	var pointIDs []string
	err := r.db.WithContext(ctx).
		Model(&Chunk{}).
		Where("user_id = ? AND document_id = ? AND qdrant_point_id <> ''", userID, documentID).
		Pluck("qdrant_point_id", &pointIDs).
		Error
	return pointIDs, err
}

// ListEnabledChunksByIDs 用 PostgreSQL 对 Qdrant 命中结果做二次校验。
// Qdrant 只负责向量相似度，最终是否能进入回答上下文必须再确认 user_id、知识库开关和索引状态。
func (r *Repository) ListEnabledChunksByIDs(ctx context.Context, userID string, chunkIDs []string) (map[string]Chunk, error) {
	if len(chunkIDs) == 0 {
		return map[string]Chunk{}, nil
	}

	var chunks []Chunk
	err := r.db.WithContext(ctx).
		Table("rag_chunks AS rc").
		Select("rc.*").
		Joins("JOIN documents AS d ON d.id = rc.document_id AND d.user_id = rc.user_id").
		Joins("JOIN rag_documents AS rd ON rd.id = rc.rag_document_id AND rd.user_id = rc.user_id").
		Where("rc.user_id = ? AND rc.id IN ?", userID, chunkIDs).
		Where("d.deleted_at IS NULL AND d.is_in_knowledge_base = TRUE").
		Where("rd.status = ?", StatusIndexed).
		Find(&chunks).
		Error
	if err != nil {
		return nil, err
	}

	result := make(map[string]Chunk, len(chunks))
	for _, chunk := range chunks {
		result[chunk.ID] = chunk
	}
	return result, nil
}
