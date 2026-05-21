package editorai

import (
	"context"
	"errors"
	"net/http"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// StreamEditorAI 处理 POST /api/v1/ai/editor/stream。
// 该接口专门服务 BlockNote 编辑器内 AI，不复用 AI Chat/RAG 的自定义 SSE 协议。
func (h *Handler) StreamEditorAI(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var req StreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid editor AI request.")
		return
	}

	prepared, err := h.service.PrepareEditorAI(c.Request.Context(), StreamInput{
		UserID:          userID,
		DocumentID:      req.DocumentID,
		Model:           req.Model,
		Messages:        req.Messages,
		ToolDefinitions: req.ToolDefinitions,
	})
	if err != nil {
		writeEditorAIError(c, err)
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.WriteHeader(http.StatusOK)

	writeStreamEvent(c, "start", StreamEvent{
		Type:  "start",
		Model: prepared.Model,
		Meta: map[string]any{
			"documentId": prepared.DocumentID,
		},
	})

	if err := h.service.StreamEditorAI(c.Request.Context(), prepared, func(event StreamEvent) error {
		writeStreamEvent(c, event.Type, event)
		return nil
	}); err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		writeStreamEvent(c, "error", StreamEvent{
			Type: "error",
			Meta: map[string]any{
				"code":    "EDITOR_AI_STREAM_ERROR",
				"message": "Failed to stream editor AI response.",
			},
		})
	}
}

func currentUserID(c *gin.Context) (string, bool) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return "", false
	}
	return userID, true
}

func writeEditorAIError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Invalid editor AI input.")
	case errors.Is(err, ErrDocumentNotFound):
		response.Error(c, http.StatusNotFound, "DOCUMENT_NOT_FOUND", "Document not found.")
	case errors.Is(err, ErrStreamUnavailable):
		response.Error(c, http.StatusServiceUnavailable, "EDITOR_AI_UNAVAILABLE", "Editor AI is unavailable.")
	default:
		response.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error.")
	}
}
