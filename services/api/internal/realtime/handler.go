package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

const heartbeatInterval = 25 * time.Second

type Handler struct {
	hub *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

func (h *Handler) StreamEvents(c *gin.Context) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return
	}

	events, unsubscribe := h.hub.Subscribe(userID)
	defer unsubscribe()

	w := c.Writer
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	connected := Event{
		ID:        fmt.Sprintf("connected-%d", time.Now().UnixNano()),
		Type:      EventConnected,
		UserID:    userID,
		CreatedAt: time.Now().UTC(),
	}
	if err := writeSSE(w, connected); err != nil {
		return
	}
	w.Flush()

	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-heartbeat.C:
			// SSE 注释行用于维持代理和浏览器连接，不进入前端业务事件解析。
			if _, err := fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
				return
			}
			w.Flush()
		case event, ok := <-events:
			if !ok {
				return
			}
			if err := writeSSE(w, event); err != nil {
				return
			}
			w.Flush()
		}
	}
}

func writeSSE(w gin.ResponseWriter, event Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "id: %s\n", event.ID); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\n", event.Type); err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "data: %s\n\n", payload)
	return err
}
