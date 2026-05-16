package chat

import (
	"encoding/json"
	"time"
)

const (
	RoleUser      = "user"
	RoleAssistant = "assistant"
	RoleSystem    = "system"
	RoleTool      = "tool"
)

// Conversation 是 AI 对话会话元信息，对应 ai_conversations 表。
// 消息正文独立放在 ai_messages，避免会话列表查询加载历史消息。
type Conversation struct {
	ID        string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    string     `gorm:"type:uuid;not null;index"`
	Title     string     `gorm:"not null;default:''"`
	CreatedAt time.Time  `gorm:"not null"`
	UpdatedAt time.Time  `gorm:"not null"`
	DeletedAt *time.Time `gorm:"index"`
}

func (Conversation) TableName() string {
	return "ai_conversations"
}

// Message 是 AI 对话消息，对应 ai_messages 表。
// Metadata 预留给模型名、token 用量、RAG 引用等扩展信息。
type Message struct {
	ID             string          `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	ConversationID string          `gorm:"type:uuid;not null;index"`
	UserID         string          `gorm:"type:uuid;not null;index"`
	Role           string          `gorm:"not null"`
	Content        string          `gorm:"not null;default:''"`
	Metadata       json.RawMessage `gorm:"type:jsonb;not null;default:'{}'::jsonb"`
	CreatedAt      time.Time       `gorm:"not null"`
	UpdatedAt      time.Time       `gorm:"not null"`
}

func (Message) TableName() string {
	return "ai_messages"
}

// ThinkingStep 对应 ai_thinking_steps 表，后续用于展示检索、工具调用等过程。
type ThinkingStep struct {
	ID        string          `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	MessageID string          `gorm:"type:uuid;not null;index"`
	UserID    string          `gorm:"type:uuid;not null;index"`
	StepType  string          `gorm:"not null;default:''"`
	Title     string          `gorm:"not null;default:''"`
	Content   string          `gorm:"not null;default:''"`
	Metadata  json.RawMessage `gorm:"type:jsonb;not null;default:'{}'::jsonb"`
	Position  int             `gorm:"not null;default:0"`
	CreatedAt time.Time       `gorm:"not null"`
	UpdatedAt time.Time       `gorm:"not null"`
}

func (ThinkingStep) TableName() string {
	return "ai_thinking_steps"
}

// ConversationDTO 是会话列表和创建会话接口返回给前端的安全视图。
type ConversationDTO struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// MessageDTO 是消息接口返回给前端的安全视图。
type MessageDTO struct {
	ID             string          `json:"id"`
	ConversationID string          `json:"conversationId"`
	Role           string          `json:"role"`
	Content        string          `json:"content"`
	Metadata       json.RawMessage `json:"metadata"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

func NewConversationDTO(conversation Conversation) ConversationDTO {
	return ConversationDTO{
		ID:        conversation.ID,
		Title:     conversation.Title,
		CreatedAt: conversation.CreatedAt,
		UpdatedAt: conversation.UpdatedAt,
	}
}

func NewMessageDTO(message Message) MessageDTO {
	metadata := message.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage("{}")
	}

	return MessageDTO{
		ID:             message.ID,
		ConversationID: message.ConversationID,
		Role:           message.Role,
		Content:        message.Content,
		Metadata:       metadata,
		CreatedAt:      message.CreatedAt,
		UpdatedAt:      message.UpdatedAt,
	}
}
