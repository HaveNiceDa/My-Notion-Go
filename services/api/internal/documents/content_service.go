package documents

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"
)

// UpdateDocumentContentInput 是保存正文的业务入参。
// Handler 负责拿到 JSON 原文，Service 负责校验它是不是编辑器需要的 JSON 数组。
type UpdateDocumentContentInput struct {
	UserID     string
	DocumentID string
	Content    []byte
}

// GetDocumentContent 获取当前用户某篇文档的正文 JSON。
func (s *Service) GetDocumentContent(ctx context.Context, userID string, documentID string) (DocumentContentDTO, error) {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	if userID == "" || !isValidUUID(documentID) {
		return DocumentContentDTO{}, ErrInvalidInput
	}

	content, err := s.repo.FindContentByDocumentID(ctx, userID, documentID)
	if err != nil {
		return DocumentContentDTO{}, err
	}

	return NewDocumentContentDTO(content), nil
}

// UpdateDocumentContent 保存编辑器正文。
// BlockNote 的根内容是 block 数组，所以 MVP 先要求 content 必须是 JSON array。
func (s *Service) UpdateDocumentContent(ctx context.Context, input UpdateDocumentContentInput) (DocumentContentDTO, error) {
	input.UserID = strings.TrimSpace(input.UserID)
	input.DocumentID = strings.TrimSpace(input.DocumentID)
	content := bytes.TrimSpace(input.Content)
	if input.UserID == "" || !isValidUUID(input.DocumentID) || !isJSONBlockArray(content) {
		return DocumentContentDTO{}, ErrInvalidInput
	}

	updated, err := s.repo.UpdateContent(ctx, input.UserID, input.DocumentID, content)
	if err != nil {
		return DocumentContentDTO{}, err
	}

	s.scheduleContentIndexRefresh(input.UserID, input.DocumentID)
	return NewDocumentContentDTO(updated), nil
}

func (s *Service) scheduleContentIndexRefresh(userID string, documentID string) {
	if s.contentUpdatedHook == nil {
		return
	}

	go func() {
		// 自动保存接口不能被 embedding/Qdrant 慢请求阻塞；后台刷新失败时由 RAG 状态记录 last_error。
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		if err := s.contentUpdatedHook(ctx, userID, documentID); err != nil {
			log.Printf("refresh rag index after content update failed: document=%s user=%s error=%v", documentID, userID, err)
		}
	}()
}

// isJSONBlockArray 只做结构层校验：必须是合法 JSON，并且顶层是数组。
// 具体 block 字段交给 BlockNote 前端 schema 处理，后端不绑定编辑器版本细节。
func isJSONBlockArray(raw []byte) bool {
	if !json.Valid(raw) {
		return false
	}

	var blocks []json.RawMessage
	return json.Unmarshal(raw, &blocks) == nil
}
