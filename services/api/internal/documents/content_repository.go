package documents

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"gorm.io/gorm"
)

// FindContentByDocumentID 读取当前用户文档的正文 JSON。
// 先按 user_id 查询文档归属，再查 content，避免只靠 document_id 泄露其他用户的正文。
func (r *Repository) FindContentByDocumentID(ctx context.Context, userID string, documentID string) (DocumentContent, error) {
	if _, err := r.FindByID(ctx, userID, documentID); err != nil {
		return DocumentContent{}, err
	}

	var content DocumentContent
	err := r.db.WithContext(ctx).
		Where("document_id = ?", documentID).
		First(&content).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DocumentContent{}, ErrNotFound
	}

	return content, err
}

// UpdateContent 覆盖保存编辑器 JSON，并递增 version。
// ContentHash 用于后续做冲突检测、去重或同步调试；当前 MVP 先随保存一起生成。
func (r *Repository) UpdateContent(ctx context.Context, userID string, documentID string, rawContent []byte) (DocumentContent, error) {
	var content DocumentContent
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := r.findByID(ctx, tx, userID, documentID); err != nil {
			return err
		}

		result := tx.Model(&DocumentContent{}).
			Where("document_id = ?", documentID).
			Updates(map[string]any{
				"content":      rawContent,
				"content_hash": contentHash(rawContent),
				"version":      gorm.Expr("version + 1"),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrNotFound
		}

		return tx.Where("document_id = ?", documentID).First(&content).Error
	})
	if err != nil {
		return DocumentContent{}, err
	}

	return content, nil
}

// contentHash 给正文 JSON 生成稳定摘要。
// 这里直接对前端传入的 JSON 字节做 hash，保持实现简单；后续需要语义去重时再做规范化 JSON。
func contentHash(rawContent []byte) string {
	sum := sha256.Sum256(rawContent)
	return hex.EncodeToString(sum[:])
}
