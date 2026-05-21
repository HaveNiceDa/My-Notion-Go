package editorai

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/bytel/my-notion-go/services/api/internal/ai"
	"github.com/bytel/my-notion-go/services/api/internal/documents"
)

var (
	ErrInvalidInput      = errors.New("invalid editor ai input")
	ErrDocumentNotFound  = errors.New("editor ai document not found")
	ErrStreamUnavailable = errors.New("editor ai stream unavailable")
)

const maxEditorAIPromptLength = 20000

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type documentFinder interface {
	FindByID(ctx context.Context, userID string, documentID string) (documents.Document, error)
}

// Service 承载编辑器内 AI 的业务边界：用户隔离、文档归属、模型白名单和流式调用编排。
type Service struct {
	documentRepo documentFinder
	aiClient     *ai.Client
}

func NewService(documentRepo documentFinder, aiClient *ai.Client) *Service {
	return &Service{
		documentRepo: documentRepo,
		aiClient:     aiClient,
	}
}

func (s *Service) PrepareEditorAI(ctx context.Context, input StreamInput) (PreparedStream, error) {
	userID := strings.TrimSpace(input.UserID)
	documentID := strings.TrimSpace(input.DocumentID)
	modelID, ok := ai.NormalizeModelID(strings.TrimSpace(input.Model))
	if userID == "" || len(input.Messages) == 0 || !ok {
		return PreparedStream{}, ErrInvalidInput
	}
	if documentID != "" {
		if !uuidPattern.MatchString(documentID) {
			return PreparedStream{}, ErrInvalidInput
		}
		if s.documentRepo == nil {
			return PreparedStream{}, ErrStreamUnavailable
		}
		if _, err := s.documentRepo.FindByID(ctx, userID, documentID); err != nil {
			if errors.Is(err, documents.ErrNotFound) {
				return PreparedStream{}, ErrDocumentNotFound
			}
			return PreparedStream{}, err
		}
	}

	userPrompt := extractLatestUserPrompt(input.Messages)
	if userPrompt == "" || utf8.RuneCountInString(userPrompt) > maxEditorAIPromptLength {
		return PreparedStream{}, ErrInvalidInput
	}

	return PreparedStream{
		UserID:          userID,
		DocumentID:      documentID,
		Model:           modelID,
		Messages:        input.Messages,
		ToolDefinitions: input.ToolDefinitions,
		LLMMessages: []aiMessage{
			{Role: "system", Content: editorAISystemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}, nil
}

func (s *Service) StreamEditorAI(ctx context.Context, prepared PreparedStream, onEvent func(StreamEvent) error) error {
	if onEvent == nil {
		return ErrInvalidInput
	}
	if s.aiClient == nil || !s.aiClient.Enabled() {
		return streamMockEditorAI(prepared, onEvent)
	}

	metadata, err := s.aiClient.StreamChat(ctx, prepared.Model, toAIMessages(prepared.LLMMessages), func(delta string) error {
		return onEvent(StreamEvent{
			Type:  "text-delta",
			Delta: delta,
		})
	})
	if err != nil {
		if errors.Is(err, ai.ErrClientNotConfigured) {
			return streamMockEditorAI(prepared, onEvent)
		}
		return err
	}

	return onEvent(StreamEvent{
		Type:  "finish",
		Model: metadata.Model,
		Meta: map[string]any{
			"provider": metadata.Provider,
		},
	})
}

func toAIMessages(messages []aiMessage) []ai.Message {
	result := make([]ai.Message, 0, len(messages))
	for _, message := range messages {
		result = append(result, ai.Message{
			Role:    message.Role,
			Content: message.Content,
		})
	}
	return result
}

func streamMockEditorAI(prepared PreparedStream, onEvent func(StreamEvent) error) error {
	mockDeltas := []string{
		"Mock editor AI response for ",
		prepared.Model,
		". The BlockNote AI API boundary is ready for frontend integration.",
	}
	for _, delta := range mockDeltas {
		if err := onEvent(StreamEvent{Type: "text-delta", Delta: delta}); err != nil {
			return err
		}
	}
	return onEvent(StreamEvent{
		Type:  "finish",
		Model: prepared.Model,
		Meta:  map[string]any{"provider": "mock"},
	})
}

func extractLatestUserPrompt(messages []UIMessage) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if strings.TrimSpace(messages[i].Role) != "user" {
			continue
		}
		if prompt := extractMessageText(messages[i]); prompt != "" {
			return prompt
		}
	}
	return ""
}

func extractMessageText(message UIMessage) string {
	if len(message.Parts) > 0 {
		parts := make([]string, 0, len(message.Parts))
		for _, part := range message.Parts {
			if strings.TrimSpace(part.Type) == "text" && strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		if len(parts) > 0 {
			return strings.Join(parts, "\n")
		}
	}

	if len(message.Content) == 0 {
		return ""
	}
	var text string
	if err := json.Unmarshal(message.Content, &text); err == nil {
		return strings.TrimSpace(text)
	}
	return strings.TrimSpace(string(message.Content))
}
