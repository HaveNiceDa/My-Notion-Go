package rag

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/chat"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

type documentIDURI struct {
	ID string `uri:"id" binding:"required"`
}

type streamRAGChatRequest struct {
	ConversationID string `json:"conversationId"`
	Message        string `json:"message" binding:"required"`
	Model          string `json:"model"`
	TopK           int    `json:"topK"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) EnableDocumentIndex(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	documentID, ok := bindDocumentID(c)
	if !ok {
		return
	}

	status, err := h.service.EnableDocumentIndex(c.Request.Context(), userID, documentID)
	if err != nil {
		writeRAGError(c, err)
		return
	}

	response.OK(c, status)
}

func (h *Handler) DisableDocumentIndex(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	documentID, ok := bindDocumentID(c)
	if !ok {
		return
	}

	status, err := h.service.DisableDocumentIndex(c.Request.Context(), userID, documentID)
	if err != nil {
		writeRAGError(c, err)
		return
	}

	response.OK(c, status)
}

func (h *Handler) GetDocumentStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	documentID, ok := bindDocumentID(c)
	if !ok {
		return
	}

	status, err := h.service.GetDocumentStatus(c.Request.Context(), userID, documentID)
	if err != nil {
		writeRAGError(c, err)
		return
	}

	response.OK(c, status)
}

// StreamRAGChat 处理 POST /api/v1/rag/chat/stream。
// SSE 事件尽量复用 AI Chat 协议，并额外发送 citations，便于前端后续展示引用来源。
func (h *Handler) StreamRAGChat(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var req streamRAGChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid RAG chat request.")
		return
	}

	prepared, err := h.service.PrepareRAGChat(c.Request.Context(), StreamChatInput{
		UserID:         userID,
		ConversationID: req.ConversationID,
		Message:        req.Message,
		Model:          req.Model,
		TopK:           req.TopK,
	})
	if err != nil {
		writeRAGError(c, err)
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.WriteHeader(http.StatusOK)

	writeSSEEvent(c, "conversation", prepared.Chat.Conversation)
	writeSSEEvent(c, "user_message", prepared.Chat.UserMessage)
	writeSSEEvent(c, "citations", gin.H{"items": prepared.Metadata.Citations, "fallback": prepared.Metadata.Fallback, "reason": prepared.Metadata.Reason})

	assistantContent, metadata, err := h.service.StreamRAGAssistant(c.Request.Context(), prepared, func(delta string) error {
		writeSSEEvent(c, "message", gin.H{"delta": delta})
		return nil
	})
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		writeSSEEvent(c, "error", gin.H{"code": "RAG_STREAM_ERROR", "message": "Failed to stream RAG assistant response."})
		return
	}

	assistantMessage, err := h.service.SaveRAGAssistantMessage(
		c.Request.Context(),
		userID,
		prepared.Chat.Conversation.ID,
		assistantContent,
		metadata,
	)
	if err != nil {
		writeSSEEvent(c, "error", gin.H{"code": "INTERNAL_ERROR", "message": "Failed to save RAG assistant message."})
		return
	}

	writeSSEEvent(c, "assistant_message", assistantMessage)
	writeSSEEvent(c, "done", gin.H{"conversationId": prepared.Chat.Conversation.ID})
}

func currentUserID(c *gin.Context) (string, bool) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return "", false
	}
	return userID, true
}

func bindDocumentID(c *gin.Context) (string, bool) {
	var uri documentIDURI
	if err := c.ShouldBindUri(&uri); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid document id.")
		return "", false
	}
	return uri.ID, true
}

func writeRAGError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Invalid RAG input.")
	case errors.Is(err, ErrDocumentNotFound):
		response.Error(c, http.StatusNotFound, "DOCUMENT_NOT_FOUND", "Document not found.")
	case errors.Is(err, ErrNoRAGContext):
		response.Error(c, http.StatusNotFound, "RAG_CONTEXT_NOT_FOUND", "No indexed knowledge base content found.")
	case errors.Is(err, chat.ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Invalid chat input.")
	case errors.Is(err, chat.ErrNotFound):
		response.Error(c, http.StatusNotFound, "CHAT_NOT_FOUND", "Chat resource not found.")
	default:
		response.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error.")
	}
}

func writeSSEEvent(c *gin.Context, event string, data any) {
	payload, err := json.Marshal(data)
	if err != nil {
		payload = []byte(`{"code":"INTERNAL_ERROR","message":"Failed to encode SSE event."}`)
		event = "error"
	}
	_, _ = fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, payload)
	c.Writer.Flush()
}
