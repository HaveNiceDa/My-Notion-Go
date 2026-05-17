package realtime

import "time"

const (
	EventConnected              = "connected"
	EventDocumentCreated        = "document.created"
	EventDocumentUpdated        = "document.updated"
	EventDocumentContentUpdated = "document.content_updated"
	EventDocumentFavoritesOrder = "document.favorites_order_updated"
	EventDocumentPublished      = "document.published"
	EventDocumentUnpublished    = "document.unpublished"
	EventDocumentArchived       = "document.archived"
	EventDocumentRestored       = "document.restored"
	EventDocumentDeleted        = "document.deleted"
)

// Event 是 SSE 推给前端的最小事件载荷。
// UserID 只用于服务端路由隔离，序列化时不暴露给浏览器。
type Event struct {
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	UserID     string    `json:"-"`
	DocumentID string    `json:"documentId,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}
