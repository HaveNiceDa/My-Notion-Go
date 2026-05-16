package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultTimeout = 2 * time.Minute

var ErrClientNotConfigured = errors.New("ai client is not configured")

// Config 描述一个兼容 OpenAI 的聊天补全端点配置
// 密钥保留在 Go API 端，不会暴露给浏览器端
type Config struct {
	APIKey  string
	BaseURL string
	Timeout time.Duration
}

// Message 是兼容 OpenAI 的 API 接受的最小聊天消息结构
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type CompletionMetadata struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type chatCompletionRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
}

type streamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
}

type errorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

func NewClient(cfg Config) *Client {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}

	return &Client{
		apiKey:  strings.TrimSpace(cfg.APIKey),
		baseURL: strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.apiKey != "" && c.baseURL != ""
}

// StreamChat 调用 /chat/completions 接口，启用流式传输，并转发每个内容片段
// 解析器处理来自兼容 OpenAI 提供商的标准 SSE 帧，包括 [DONE] 标记
func (c *Client) StreamChat(ctx context.Context, model string, messages []Message, onDelta func(string) error) (CompletionMetadata, error) {
	if !c.Enabled() {
		return CompletionMetadata{}, ErrClientNotConfigured
	}
	if len(messages) == 0 {
		return CompletionMetadata{}, errors.New("ai messages are required")
	}

	body, err := json.Marshal(chatCompletionRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	})
	if err != nil {
		return CompletionMetadata{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return CompletionMetadata{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return CompletionMetadata{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return CompletionMetadata{}, readAPIError(resp)
	}

	if err := parseStream(resp.Body, onDelta); err != nil {
		return CompletionMetadata{}, err
	}

	return CompletionMetadata{
		Provider: "openai-compatible",
		Model:    model,
	}, nil
}

func readAPIError(resp *http.Response) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return fmt.Errorf("llm request failed with status %d", resp.StatusCode)
	}

	var parsed errorResponse
	if err := json.Unmarshal(body, &parsed); err == nil && parsed.Error.Message != "" {
		return fmt.Errorf("llm request failed with status %d: %s", resp.StatusCode, parsed.Error.Message)
	}

	return fmt.Errorf("llm request failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
}

func parseStream(reader io.Reader, onDelta func(string) error) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 1024), 1024*1024)

	var dataLines []string
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if err := dispatchEvent(dataLines, onDelta); err != nil {
				return err
			}
			dataLines = nil
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return dispatchEvent(dataLines, onDelta)
}

func dispatchEvent(dataLines []string, onDelta func(string) error) error {
	if len(dataLines) == 0 {
		return nil
	}

	payload := strings.Join(dataLines, "\n")
	if payload == "[DONE]" {
		return nil
	}

	var chunk streamChunk
	if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
		return err
	}

	for _, choice := range chunk.Choices {
		if choice.Delta.Content == "" {
			continue
		}
		if err := onDelta(choice.Delta.Content); err != nil {
			return err
		}
	}
	return nil
}
