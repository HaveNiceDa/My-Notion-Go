package rag

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/bytel/my-notion-go/services/api/internal/documents"
)

var (
	ErrInvalidInput      = errors.New("invalid rag input")
	ErrDocumentNotFound  = errors.New("rag document not found")
	ErrRepositoryFailure = errors.New("rag repository failure")
)

var ragUUIDPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type Service struct {
	repo    *Repository
	docRepo *documents.Repository
	qdrant  *QdrantClient
}

func NewService(repo *Repository, docRepo *documents.Repository, qdrant *QdrantClient) *Service {
	return &Service{
		repo:    repo,
		docRepo: docRepo,
		qdrant:  qdrant,
	}
}

// EnableDocumentIndex 是“把文档重新纳入知识库”的入口。
// 这里先只写产品开关和 pending 状态，真正的切块/embedding/Qdrant upsert 留给后续索引流程。
func (s *Service) EnableDocumentIndex(ctx context.Context, userID string, documentID string) (DocumentStatusDTO, error) {
	document, err := s.findDocument(ctx, userID, documentID)
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	updated, err := s.docRepo.UpdateMetadata(ctx, userID, documentID, map[string]any{
		"is_in_knowledge_base": true,
	})
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	// M5.1 只落状态骨架，不在请求内执行切块和向量化。后续 worker 会消费 pending 状态。
	status, err := s.repo.UpsertDocumentStatus(ctx, userID, document.ID, StatusPending)
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	return NewDocumentStatusDTO(updated.ID, updated.IsInKnowledgeBase, &status), nil
}

// DisableDocumentIndex 表示用户显式把文档移出知识库。
// 当前阶段只更新状态；M5.2 接入 Qdrant 后，这里还需要删除对应 point 或标记失效。
func (s *Service) DisableDocumentIndex(ctx context.Context, userID string, documentID string) (DocumentStatusDTO, error) {
	document, err := s.findDocument(ctx, userID, documentID)
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	updated, err := s.docRepo.UpdateMetadata(ctx, userID, documentID, map[string]any{
		"is_in_knowledge_base": false,
	})
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	status, err := s.repo.UpsertDocumentStatus(ctx, userID, document.ID, StatusDisabled)
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	return NewDocumentStatusDTO(updated.ID, updated.IsInKnowledgeBase, &status), nil
}

// GetDocumentStatus 兼容“默认开启知识库”的产品规则。
// 如果文档开关为 true 但还没有 rag_documents 记录，就懒创建 pending，避免创建文档时耦合 RAG 表写入。
func (s *Service) GetDocumentStatus(ctx context.Context, userID string, documentID string) (DocumentStatusDTO, error) {
	document, err := s.findDocument(ctx, userID, documentID)
	if err != nil {
		return DocumentStatusDTO{}, err
	}

	status, err := s.repo.FindByDocumentID(ctx, userID, document.ID)
	if err == nil {
		return NewDocumentStatusDTO(document.ID, document.IsInKnowledgeBase, &status), nil
	}
	if !errors.Is(err, ErrStatusNotFound) {
		return DocumentStatusDTO{}, err
	}
	if !document.IsInKnowledgeBase {
		return NewDocumentStatusDTO(document.ID, false, nil), nil
	}

	// 文档默认开启知识库：第一次查询状态时，如果还没有索引记录，就创建 pending 占位。
	status, err = s.repo.UpsertDocumentStatus(ctx, userID, document.ID, StatusPending)
	if err != nil {
		return DocumentStatusDTO{}, err
	}
	return NewDocumentStatusDTO(document.ID, true, &status), nil
}

// findDocument 是所有 RAG 操作的归属校验入口。
// 先按 documents 表校验 user_id + document_id，再允许读写 RAG 状态，确保权限边界一致。
func (s *Service) findDocument(ctx context.Context, userID string, documentID string) (documents.Document, error) {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	if userID == "" || !ragUUIDPattern.MatchString(documentID) {
		return documents.Document{}, ErrInvalidInput
	}

	document, err := s.docRepo.FindByID(ctx, userID, documentID)
	if errors.Is(err, documents.ErrNotFound) {
		return documents.Document{}, ErrDocumentNotFound
	}
	return document, err
}
