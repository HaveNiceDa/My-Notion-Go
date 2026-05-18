package realtime

import (
	"context"
	"testing"
	"time"
)

func TestHubPublishDeliversOnlyToMatchingUser_BitsUT(t *testing.T) {
	t.Run("事件只投递给同一用户的订阅者", func(t *testing.T) {
		hub := NewHub()
		userEvents, unsubscribeUser := hub.Subscribe("user-a")
		defer unsubscribeUser()
		otherEvents, unsubscribeOther := hub.Subscribe("user-b")
		defer unsubscribeOther()

		hub.Publish(Event{
			ID:         "event-1",
			Type:       EventDocumentUpdated,
			UserID:     "user-a",
			DocumentID: "doc-1",
			CreatedAt:  time.Now().UTC(),
		})

		got := receiveEvent(t, userEvents)
		if got.ID != "event-1" || got.DocumentID != "doc-1" {
			t.Fatalf("unexpected delivered event: %+v", got)
		}
		assertNoEvent(t, otherEvents)
	})
}

func TestHubPublishFansOutToSameUserSubscribers_BitsUT(t *testing.T) {
	t.Run("同一用户的多个连接都会收到事件", func(t *testing.T) {
		hub := NewHub()
		firstEvents, unsubscribeFirst := hub.Subscribe("user-a")
		defer unsubscribeFirst()
		secondEvents, unsubscribeSecond := hub.Subscribe("user-a")
		defer unsubscribeSecond()

		hub.Publish(Event{
			ID:        "event-1",
			Type:      EventDocumentArchived,
			UserID:    "user-a",
			CreatedAt: time.Now().UTC(),
		})

		if got := receiveEvent(t, firstEvents); got.ID != "event-1" {
			t.Fatalf("first subscriber received unexpected event: %+v", got)
		}
		if got := receiveEvent(t, secondEvents); got.ID != "event-1" {
			t.Fatalf("second subscriber received unexpected event: %+v", got)
		}
	})
}

func TestHubUnsubscribeClosesChannelAndStopsDelivery_BitsUT(t *testing.T) {
	t.Run("退订后关闭连接通道并停止后续投递", func(t *testing.T) {
		hub := NewHub()
		events, unsubscribe := hub.Subscribe("user-a")

		unsubscribe()
		if _, ok := <-events; ok {
			t.Fatal("subscriber channel should be closed after unsubscribe")
		}

		// 退订后的发布不应因为已移除的订阅者而阻塞或写入已关闭通道。
		hub.Publish(Event{
			ID:        "event-after-unsubscribe",
			Type:      EventDocumentDeleted,
			UserID:    "user-a",
			CreatedAt: time.Now().UTC(),
		})
	})
}

func TestHubPublishDropsWhenSubscriberBufferIsFull_BitsUT(t *testing.T) {
	t.Run("慢连接缓冲区满时发布不会阻塞业务写请求", func(t *testing.T) {
		hub := NewHub()
		events, unsubscribe := hub.Subscribe("user-a")
		defer unsubscribe()

		for i := 0; i < subscriberBufferSize; i++ {
			hub.Publish(Event{
				ID:        "buffered",
				Type:      EventDocumentContentUpdated,
				UserID:    "user-a",
				CreatedAt: time.Now().UTC(),
			})
		}

		done := make(chan struct{})
		go func() {
			defer close(done)
			hub.Publish(Event{
				ID:        "dropped-when-full",
				Type:      EventDocumentContentUpdated,
				UserID:    "user-a",
				CreatedAt: time.Now().UTC(),
			})
		}()

		select {
		case <-done:
		case <-time.After(100 * time.Millisecond):
			t.Fatal("Publish should not block when subscriber buffer is full")
		}

		for i := 0; i < subscriberBufferSize; i++ {
			receiveEvent(t, events)
		}
		assertNoEvent(t, events)
	})
}

func TestHubPublishDocumentEventBuildsDocumentPayload_BitsUT(t *testing.T) {
	t.Run("文档事件包含类型文档 ID 和服务端生成的事件 ID", func(t *testing.T) {
		hub := NewHub()
		events, unsubscribe := hub.Subscribe("user-a")
		defer unsubscribe()

		hub.PublishDocumentEvent(context.Background(), "user-a", EventDocumentPublished, "doc-1")

		got := receiveEvent(t, events)
		if got.Type != EventDocumentPublished {
			t.Fatalf("unexpected event type: %s", got.Type)
		}
		if got.UserID != "user-a" || got.DocumentID != "doc-1" {
			t.Fatalf("unexpected event routing payload: %+v", got)
		}
		if got.ID == "" {
			t.Fatal("event ID should be generated")
		}
		if got.CreatedAt.IsZero() {
			t.Fatal("event CreatedAt should be set")
		}
	})
}

func receiveEvent(t *testing.T, events <-chan Event) Event {
	t.Helper()

	select {
	case event, ok := <-events:
		if !ok {
			t.Fatal("event channel closed before receiving event")
		}
		return event
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timed out waiting for realtime event")
	}

	return Event{}
}

func assertNoEvent(t *testing.T, events <-chan Event) {
	t.Helper()

	select {
	case event, ok := <-events:
		if ok {
			t.Fatalf("unexpected event received: %+v", event)
		}
	case <-time.After(20 * time.Millisecond):
	}
}
