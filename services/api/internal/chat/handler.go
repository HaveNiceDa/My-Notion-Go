package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

// Handler 负责 AI Chat 模块的 HTTP 入参解析、鉴权上下文读取和 SSE 输出。
type Handler struct {
	service *Service
}

type conversationIDURI struct {
	ID string `uri:"id" binding:"required"`
}

type createConversationRequest struct {
	Title string `json:"title"`
}

type streamChatRequest struct {
	ConversationID string `json:"conversationId"`
	Message        string `json:"message" binding:"required"`
	Model          string `json:"model"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// CreateConversation 处理 POST /api/v1/ai/conversations。
func (h *Handler) CreateConversation(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var req createConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid create conversation request.")
		return
	}

	conversation, err := h.service.CreateConversation(c.Request.Context(), CreateConversationInput{
		UserID: userID,
		Title:  req.Title,
	})
	if err != nil {
		writeChatError(c, err)
		return
	}

	response.Created(c, conversation)
}

// ListConversations 处理 GET /api/v1/ai/conversations。
func (h *Handler) ListConversations(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	conversations, err := h.service.ListConversations(c.Request.Context(), userID)
	if err != nil {
		writeChatError(c, err)
		return
	}

	response.OK(c, conversations)
}

// ListMessages 处理 GET /api/v1/ai/conversations/:id/messages。
func (h *Handler) ListMessages(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindConversationID(c)
	if !ok {
		return
	}

	messages, err := h.service.ListMessages(c.Request.Context(), userID, id)
	if err != nil {
		writeChatError(c, err)
		return
	}

	response.OK(c, messages)
}

// StreamChat 处理 POST /api/v1/ai/chat/stream。
// 无论底层是真实 LLM 还是 mock fallback，都保持同一套 SSE 事件协议。
func (h *Handler) StreamChat(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var req streamChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid stream chat request.")
		return
	}

	prepared, err := h.service.PrepareChat(c.Request.Context(), SendMessageInput{
		UserID:         userID,
		ConversationID: req.ConversationID,
		Message:        req.Message,
		Model:          req.Model,
	})
	if err != nil {
		writeChatError(c, err)
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.WriteHeader(http.StatusOK)

	writeSSEEvent(c, "conversation", prepared.Conversation)
	writeSSEEvent(c, "user_message", prepared.UserMessage)

	assistantContent, metadata, err := h.service.StreamAssistant(c.Request.Context(), prepared, func(delta string) error {
		writeSSEEvent(c, "message", gin.H{"delta": delta})
		return nil
	})
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		writeSSEEvent(c, "error", gin.H{"code": "LLM_STREAM_ERROR", "message": "Failed to stream assistant response."})
		return
	}

	assistantMessage, err := h.service.SaveAssistantMessage(
		c.Request.Context(),
		userID,
		prepared.Conversation.ID,
		assistantContent,
		metadata,
	)
	if err != nil {
		writeSSEEvent(c, "error", gin.H{"code": "INTERNAL_ERROR", "message": "Failed to save assistant message."})
		return
	}

	writeSSEEvent(c, "assistant_message", assistantMessage)
	writeSSEEvent(c, "done", gin.H{"conversationId": prepared.Conversation.ID})
}

func currentUserID(c *gin.Context) (string, bool) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return "", false
	}

	return userID, true
}

func bindConversationID(c *gin.Context) (string, bool) {
	var uri conversationIDURI
	if err := c.ShouldBindUri(&uri); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid conversation id.")
		return "", false
	}

	return uri.ID, true
}

func writeChatError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Invalid chat input.")
	case errors.Is(err, ErrNotFound):
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
