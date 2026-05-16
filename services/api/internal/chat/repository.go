package chat

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

var ErrNotFound = errors.New("chat resource not found")

// Repository 封装 AI Chat 模块的数据访问。
// Service 不直接依赖 GORM 查询细节，便于后续替换为更复杂的会话检索策略。
type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateConversation 创建一个属于当前用户的 AI 会话。
func (r *Repository) CreateConversation(ctx context.Context, conversation *Conversation) error {
	return r.db.WithContext(ctx).Create(conversation).Error
}

// ListConversations 返回当前用户的会话列表，按最近更新时间倒序。
func (r *Repository) ListConversations(ctx context.Context, userID string) ([]Conversation, error) {
	var conversations []Conversation
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("updated_at DESC").
		Order("created_at DESC").
		Find(&conversations).
		Error
	return conversations, err
}

// FindConversationByID 查询当前用户拥有的会话。
func (r *Repository) FindConversationByID(ctx context.Context, userID string, conversationID string) (Conversation, error) {
	var conversation Conversation
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", conversationID, userID).
		First(&conversation).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Conversation{}, ErrNotFound
	}

	return conversation, err
}

// ListMessages 返回会话下的消息，先校验会话归属再读取消息，避免越权访问。
func (r *Repository) ListMessages(ctx context.Context, userID string, conversationID string) ([]Message, error) {
	if _, err := r.FindConversationByID(ctx, userID, conversationID); err != nil {
		return nil, err
	}

	var messages []Message
	err := r.db.WithContext(ctx).
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Order("created_at ASC").
		Find(&messages).
		Error
	return messages, err
}

// CreateMessage 保存单条消息，并触发会话 updated_at 更新，让会话列表按最近消息排序。
func (r *Repository) CreateMessage(ctx context.Context, message *Message) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := r.findConversationByID(ctx, tx, message.UserID, message.ConversationID); err != nil {
			return err
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}

		return tx.Model(&Conversation{}).
			Where("id = ? AND user_id = ?", message.ConversationID, message.UserID).
			Update("updated_at", gorm.Expr("NOW()")).
			Error
	})
}

func (r *Repository) findConversationByID(ctx context.Context, db *gorm.DB, userID string, conversationID string) (Conversation, error) {
	var conversation Conversation
	err := db.WithContext(ctx).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", conversationID, userID).
		First(&conversation).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Conversation{}, ErrNotFound
	}

	return conversation, err
}
