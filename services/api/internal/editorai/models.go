package editorai

import "encoding/json"

// StreamRequest 对齐 BlockNote AI / AI SDK 发给后端的请求体，同时允许前端追加业务字段。
// messages 和 toolDefinitions 保留原始 JSON，避免 Go 结构过早绑定 AI SDK 的内部协议细节。
type StreamRequest struct {
	Messages        []UIMessage     `json:"messages"`
	ToolDefinitions json.RawMessage `json:"toolDefinitions"`
	DocumentID      string          `json:"documentId"`
	Model           string          `json:"model"`
}

// UIMessage 只提取后端当前需要的最小字段；metadata 中可能包含 BlockNote document state。
type UIMessage struct {
	ID       string          `json:"id"`
	Role     string          `json:"role"`
	Content  json.RawMessage `json:"content"`
	Metadata json.RawMessage `json:"metadata"`
	Parts    []UIMessagePart `json:"parts"`
}

type UIMessagePart struct {
	Type string          `json:"type"`
	Text string          `json:"text"`
	Data json.RawMessage `json:"data"`
}

type StreamInput struct {
	UserID          string
	DocumentID      string
	Model           string
	Messages        []UIMessage
	ToolDefinitions json.RawMessage
}

type PreparedStream struct {
	UserID          string
	DocumentID      string
	Model           string
	Messages        []UIMessage
	ToolDefinitions json.RawMessage
	LLMMessages     []aiMessage
}

// StreamEvent 是当前 Go API 暴露给前端的编辑器 AI 流式事件外壳。
// 后续实现完整 AI SDK Data/UI Stream 时，可以集中替换 stream.go 的编码策略。
type StreamEvent struct {
	Type  string         `json:"type"`
	Delta string         `json:"delta,omitempty"`
	Model string         `json:"model,omitempty"`
	Meta  map[string]any `json:"meta,omitempty"`
}

type aiMessage struct {
	Role    string
	Content string
}
