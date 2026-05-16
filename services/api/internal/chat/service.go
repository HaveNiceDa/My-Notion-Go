package chat

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var ErrInvalidInput = errors.New("invalid chat input")

const (
	defaultConversationTitle = "New chat"
	maxMessageLength         = 12000
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// Service 承载 AI Chat 业务规则：会话归属、消息校验和 mock 流式响应生成。
type Service struct {
	repo *Repository
}

type CreateConversationInput struct {
	UserID string
	Title  string
}

type SendMessageInput struct {
	UserID         string
	ConversationID string
	Message        string
}

// PreparedChat 是开始 SSE 前准备好的上下文。
// Handler 用它先把 conversation 事件发给前端，再逐段发送 mock delta。
type PreparedChat struct {
	Conversation ConversationDTO
	UserMessage  MessageDTO
	Deltas       []string
	FullResponse string
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
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

// PrepareMockChat 保存用户消息并生成 mock assistant 响应。
// 真实 LLM 接入后，这里可以替换成 ai.Client.Stream(ctx, messages)。
func (s *Service) PrepareMockChat(ctx context.Context, input SendMessageInput) (PreparedChat, error) {
	userID := strings.TrimSpace(input.UserID)
	conversationID := strings.TrimSpace(input.ConversationID)
	messageContent := strings.TrimSpace(input.Message)
	if userID == "" || messageContent == "" || utf8.RuneCountInString(messageContent) > maxMessageLength {
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

	fullResponse := mockAssistantResponse(messageContent)
	return PreparedChat{
		Conversation: conversation,
		UserMessage:  NewMessageDTO(userMessage),
		Deltas:       splitDeltas(fullResponse),
		FullResponse: fullResponse,
	}, nil
}

func (s *Service) SaveAssistantMessage(ctx context.Context, userID string, conversationID string, content string) (MessageDTO, error) {
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
		Metadata:       json.RawMessage(`{"provider":"mock"}`),
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
