package chat

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/bytel/my-notion-go/services/api/internal/ai"
)

var ErrInvalidInput = errors.New("invalid chat input")

const (
	defaultConversationTitle = "New chat"
	maxMessageLength         = 12000
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var generatedTitlePlaceholders = map[string]struct{}{
	"":                       {},
	defaultConversationTitle: {},
	"New AI chat":            {},
	"新 AI 会话":                {},
}

// Service 承载 AI Chat 业务规则：会话归属、消息校验和 LLM/mock 流式响应生成。
type Service struct {
	repo     *Repository
	aiClient *ai.Client
}

type CreateConversationInput struct {
	UserID string
	Title  string
}

type SendMessageInput struct {
	UserID         string
	ConversationID string
	Message        string
	Model          string
}

// PreparedChat 是开始 SSE 前准备好的上下文。
// Handler 用它先把 conversation 事件发给前端，再逐段发送 LLM 或 mock delta。
type PreparedChat struct {
	Conversation ConversationDTO
	UserMessage  MessageDTO
	Messages     []ai.Message
	Model        string
}

func NewService(repo *Repository, aiClient *ai.Client) *Service {
	return &Service{
		repo:     repo,
		aiClient: aiClient,
	}
}

func (s *Service) CreateConversation(ctx context.Context, input CreateConversationInput) (ConversationDTO, error) {
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return ConversationDTO{}, ErrInvalidInput
	}

	conversation := Conversation{
		UserID: userID,
		Title:  normalizeConversationTitle(input.Title),
	}
	if err := s.repo.CreateConversation(ctx, &conversation); err != nil {
		return ConversationDTO{}, err
	}

	return NewConversationDTO(conversation), nil
}

func (s *Service) ListConversations(ctx context.Context, userID string) ([]ConversationDTO, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrInvalidInput
	}

	conversations, err := s.repo.ListConversations(ctx, userID)
	if err != nil {
		return nil, err
	}

	return mapConversations(conversations), nil
}

func (s *Service) ListMessages(ctx context.Context, userID string, conversationID string) ([]MessageDTO, error) {
	userID = strings.TrimSpace(userID)
	conversationID = strings.TrimSpace(conversationID)
	if userID == "" || !isValidUUID(conversationID) {
		return nil, ErrInvalidInput
	}

	messages, err := s.repo.ListMessages(ctx, userID, conversationID)
	if err != nil {
		return nil, err
	}

	return mapMessages(messages), nil
}

// PrepareChat 保存用户消息，并整理发给 LLM 的上下文消息。
// 消息先落库再发起流式请求，能保证即使客户端中途断开，用户输入也不会丢失。
func (s *Service) PrepareChat(ctx context.Context, input SendMessageInput) (PreparedChat, error) {
	userID := strings.TrimSpace(input.UserID)
	conversationID := strings.TrimSpace(input.ConversationID)
	messageContent := strings.TrimSpace(input.Message)
	modelID, ok := ai.NormalizeModelID(strings.TrimSpace(input.Model))
	if userID == "" || messageContent == "" || utf8.RuneCountInString(messageContent) > maxMessageLength {
		return PreparedChat{}, ErrInvalidInput
	}
	if !ok {
		return PreparedChat{}, ErrInvalidInput
	}

	var conversation ConversationDTO
	if conversationID == "" {
		created, err := s.CreateConversation(ctx, CreateConversationInput{
			UserID: userID,
			Title:  titleFromMessage(messageContent),
		})
		if err != nil {
			return PreparedChat{}, err
		}
		conversation = created
		conversationID = created.ID
	} else {
		if !isValidUUID(conversationID) {
			return PreparedChat{}, ErrInvalidInput
		}
		existing, err := s.repo.FindConversationByID(ctx, userID, conversationID)
		if err != nil {
			return PreparedChat{}, err
		}
		conversation = NewConversationDTO(existing)
	}

	userMessage := Message{
		ConversationID: conversationID,
		UserID:         userID,
		Role:           RoleUser,
		Content:        messageContent,
		Metadata:       json.RawMessage("{}"),
	}
	if err := s.repo.CreateMessage(ctx, &userMessage); err != nil {
		return PreparedChat{}, err
	}

	messages, err := s.repo.ListMessages(ctx, userID, conversationID)
	if err != nil {
		return PreparedChat{}, err
	}
	if shouldGenerateTitle(conversation.Title, messages) {
		// 手动新建的空会话会先使用占位标题；首条用户消息落库后再生成标题，保证刷新后会话列表稳定。
		updated, err := s.repo.UpdateConversationTitle(ctx, userID, conversationID, titleFromMessage(messageContent))
		if err != nil {
			return PreparedChat{}, err
		}
		conversation = NewConversationDTO(updated)
	}

	return PreparedChat{
		Conversation: conversation,
		UserMessage:  NewMessageDTO(userMessage),
		Messages:     toAIMessages(messages),
		Model:        modelID,
	}, nil
}

// StreamAssistant 统一封装真实 LLM 和本地 mock fallback。
// 没有配置 API key 时保持 mock，避免本地开发和 smoke 测试强依赖外部模型服务。
func (s *Service) StreamAssistant(ctx context.Context, prepared PreparedChat, onDelta func(string) error) (string, json.RawMessage, error) {
	if s.aiClient != nil && s.aiClient.Enabled() {
		var fullResponse strings.Builder
		metadata, err := s.aiClient.StreamChat(ctx, prepared.Model, prepared.Messages, func(delta string) error {
			fullResponse.WriteString(delta)
			return onDelta(delta)
		})
		if err != nil {
			return "", nil, err
		}

		rawMetadata, err := json.Marshal(metadata)
		if err != nil {
			return "", nil, err
		}
		return fullResponse.String(), json.RawMessage(rawMetadata), nil
	}

	fullResponse := mockAssistantResponse(lastUserMessage(prepared.Messages))
	for _, delta := range splitDeltas(fullResponse) {
		select {
		case <-ctx.Done():
			return "", nil, ctx.Err()
		default:
			if err := onDelta(delta); err != nil {
				return "", nil, err
			}
			time.Sleep(60 * time.Millisecond)
		}
	}
	rawMetadata, err := json.Marshal(ai.CompletionMetadata{
		Provider: "mock",
		Model:    prepared.Model,
	})
	if err != nil {
		return "", nil, err
	}
	return fullResponse, json.RawMessage(rawMetadata), nil
}

func (s *Service) SaveAssistantMessage(ctx context.Context, userID string, conversationID string, content string, metadata json.RawMessage) (MessageDTO, error) {
	userID = strings.TrimSpace(userID)
	conversationID = strings.TrimSpace(conversationID)
	content = strings.TrimSpace(content)
	if userID == "" || !isValidUUID(conversationID) || content == "" {
		return MessageDTO{}, ErrInvalidInput
	}

	message := Message{
		ConversationID: conversationID,
		UserID:         userID,
		Role:           RoleAssistant,
		Content:        content,
		Metadata:       normalizeMetadata(metadata),
	}
	if err := s.repo.CreateMessage(ctx, &message); err != nil {
		return MessageDTO{}, err
	}

	return NewMessageDTO(message), nil
}

func normalizeConversationTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return defaultConversationTitle
	}
	return trimRunes(title, 80)
}

func titleFromMessage(message string) string {
	return normalizeConversationTitle(message)
}

func shouldGenerateTitle(currentTitle string, messages []Message) bool {
	if len(messages) != 1 || messages[0].Role != RoleUser {
		return false
	}
	_, ok := generatedTitlePlaceholders[strings.TrimSpace(currentTitle)]
	return ok
}

func mockAssistantResponse(message string) string {
	return "Mock AI response: I received your message, \"" + message + "\". SSE streaming is ready for the next frontend integration step."
}

func splitDeltas(content string) []string {
	words := strings.Fields(content)
	if len(words) == 0 {
		return []string{content}
	}

	deltas := make([]string, 0, len(words))
	for index, word := range words {
		if index == 0 {
			deltas = append(deltas, word)
			continue
		}
		deltas = append(deltas, " "+word)
	}

	return deltas
}

func toAIMessages(messages []Message) []ai.Message {
	result := make([]ai.Message, 0, len(messages))
	for _, message := range messages {
		if message.Role != RoleUser && message.Role != RoleAssistant && message.Role != RoleSystem {
			continue
		}
		if strings.TrimSpace(message.Content) == "" {
			continue
		}
		result = append(result, ai.Message{
			Role:    message.Role,
			Content: message.Content,
		})
	}
	return result
}

func lastUserMessage(messages []ai.Message) string {
	for index := len(messages) - 1; index >= 0; index-- {
		if messages[index].Role == RoleUser {
			return messages[index].Content
		}
	}
	return ""
}

func normalizeMetadata(metadata json.RawMessage) json.RawMessage {
	if len(metadata) == 0 {
		return json.RawMessage("{}")
	}
	return metadata
}

func mapConversations(conversations []Conversation) []ConversationDTO {
	result := make([]ConversationDTO, 0, len(conversations))
	for _, conversation := range conversations {
		result = append(result, NewConversationDTO(conversation))
	}
	return result
}

func mapMessages(messages []Message) []MessageDTO {
	result := make([]MessageDTO, 0, len(messages))
	for _, message := range messages {
		result = append(result, NewMessageDTO(message))
	}
	return result
}

func trimRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}

func isValidUUID(id string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(id))
}
