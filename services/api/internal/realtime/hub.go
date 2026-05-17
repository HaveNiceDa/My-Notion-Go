package realtime

import (
	"context"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

const subscriberBufferSize = 16

// Hub 是 M7.0 的单进程用户级事件总线。
// 后续多 API 实例部署时，可以在这个边界后面接 Redis Pub/Sub，而不影响业务模块调用方式。
type Hub struct {
	mu          sync.RWMutex
	subscribers map[string]map[uint64]chan Event
	nextID      atomic.Uint64
}

func NewHub() *Hub {
	return &Hub{
		subscribers: make(map[string]map[uint64]chan Event),
	}
}

func (h *Hub) Subscribe(userID string) (<-chan Event, func()) {
	subscriberID := h.nextID.Add(1)
	ch := make(chan Event, subscriberBufferSize)

	h.mu.Lock()
	if h.subscribers[userID] == nil {
		h.subscribers[userID] = make(map[uint64]chan Event)
	}
	h.subscribers[userID][subscriberID] = ch
	h.mu.Unlock()

	unsubscribe := func() {
		h.mu.Lock()
		defer h.mu.Unlock()

		userSubscribers := h.subscribers[userID]
		if userSubscribers == nil {
			return
		}
		if subscriber, ok := userSubscribers[subscriberID]; ok {
			delete(userSubscribers, subscriberID)
			close(subscriber)
		}
		if len(userSubscribers) == 0 {
			delete(h.subscribers, userID)
		}
	}

	return ch, unsubscribe
}

func (h *Hub) PublishDocumentEvent(_ context.Context, userID string, eventType string, documentID string) {
	event := Event{
		ID:         strconv.FormatUint(h.nextID.Add(1), 10),
		Type:       eventType,
		UserID:     userID,
		DocumentID: documentID,
		CreatedAt:  time.Now().UTC(),
	}
	h.Publish(event)
}

func (h *Hub) Publish(event Event) {
	h.mu.RLock()
	userSubscribers := h.subscribers[event.UserID]
	channels := make([]chan Event, 0, len(userSubscribers))
	for _, ch := range userSubscribers {
		channels = append(channels, ch)
	}
	h.mu.RUnlock()

	for _, ch := range channels {
		select {
		case ch <- event:
		default:
			// 慢连接不阻塞业务写请求；前端会通过下一次 invalidate 重新获取最终态。
		}
	}
}
