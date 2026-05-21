package editorai

import (
	"encoding/json"
	"fmt"

	"github.com/gin-gonic/gin"
)

// writeStreamEvent 目前输出项目自有的 SSE 外壳，用于先固定 Go API 边界。
// 后续完整接入 BlockNote AI 时，只需要在这里替换为 AI SDK Data/UI Stream frame 编码。
func writeStreamEvent(c *gin.Context, event string, data any) {
	payload, err := json.Marshal(data)
	if err != nil {
		event = "error"
		payload = []byte(`{"type":"error","message":"Failed to encode editor AI stream event."}`)
	}
	_, _ = fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, payload)
	c.Writer.Flush()
}
