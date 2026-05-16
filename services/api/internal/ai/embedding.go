package ai

import (
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

const dashScopeMultimodalEmbeddingPath = "/services/embeddings/multimodal-embedding/multimodal-embedding"

// EmbeddingConfig 描述 DashScope 原生多模态 embedding 端点配置。
// 它和 AI Chat 的 OpenAI Compatible base URL 分离，避免把两种协议的请求格式混用。
type EmbeddingConfig struct {
	APIKey  string
	BaseURL string
	Timeout time.Duration
}

// EmbeddingClient 负责把文本批量转换为向量。
// RAG 模块只依赖这个能力，不需要关心具体上游供应商。
type EmbeddingClient struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type embeddingRequest struct {
	Model      string                 `json:"model"`
	Input      embeddingInput         `json:"input"`
	Parameters embeddingRequestParams `json:"parameters"`
}

type embeddingInput struct {
	Contents []embeddingContent `json:"contents"`
}

type embeddingContent struct {
	Text string `json:"text,omitempty"`
}

type embeddingRequestParams struct {
	OutputType string `json:"output_type"`
	Dimension  int    `json:"dimension"`
}

type embeddingResponse struct {
	Output struct {
		Embeddings []embeddingItem `json:"embeddings"`
	} `json:"output"`
	RequestID string `json:"request_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
}

type embeddingItem struct {
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
	Type      string    `json:"type"`
}

type dashScopeErrorResponse struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
	Output    struct {
		Message string `json:"message"`
	} `json:"output"`
	Error struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error"`
}

func NewEmbeddingClient(cfg EmbeddingConfig) *EmbeddingClient {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}

	return &EmbeddingClient{
		apiKey:  strings.TrimSpace(cfg.APIKey),
		baseURL: strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *EmbeddingClient) Enabled() bool {
	return c != nil && c.apiKey != "" && c.baseURL != ""
}

// EmbedTexts 调用 DashScope 原生多模态 embedding API 生成纯文本向量，并按请求 input 顺序返回结果。
// 多模态 API 也使用 index 字段表达原始位置，因此这里显式重排，避免批量索引时 chunk 和向量错位。
func (c *EmbeddingClient) EmbedTexts(ctx context.Context, model string, texts []string) ([][]float32, error) {
	if !c.Enabled() {
		return nil, ErrClientNotConfigured
	}
	model = strings.TrimSpace(model)
	if model == "" || len(texts) == 0 {
		return nil, errors.New("embedding model and input are required")
	}

	contents := make([]embeddingContent, 0, len(texts))
	for _, text := range texts {
		trimmed := strings.TrimSpace(text)
		if trimmed == "" {
			return nil, errors.New("embedding text input cannot be empty")
		}
		contents = append(contents, embeddingContent{Text: trimmed})
	}

	body, err := json.Marshal(embeddingRequest{
		Model: model,
		Input: embeddingInput{
			Contents: contents,
		},
		Parameters: embeddingRequestParams{
			OutputType: "dense",
			Dimension:  DefaultEmbeddingDimension,
		},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+dashScopeMultimodalEmbeddingPath, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, readDashScopeAPIError(resp)
	}

	var parsed embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if parsed.Code != "" {
		return nil, fmt.Errorf("dashscope embedding request failed: %s: %s", parsed.Code, parsed.Message)
	}
	if len(parsed.Output.Embeddings) != len(texts) {
		return nil, fmt.Errorf("embedding response count mismatch: want %d, got %d", len(texts), len(parsed.Output.Embeddings))
	}

	vectors := make([][]float32, len(texts))
	for _, item := range parsed.Output.Embeddings {
		if item.Index < 0 || item.Index >= len(vectors) {
			return nil, fmt.Errorf("embedding response index out of range: %d", item.Index)
		}
		if len(item.Embedding) == 0 {
			return nil, fmt.Errorf("embedding vector is empty at index %d", item.Index)
		}
		if len(item.Embedding) != DefaultEmbeddingDimension {
			return nil, fmt.Errorf("embedding dimension mismatch at index %d: want %d, got %d", item.Index, DefaultEmbeddingDimension, len(item.Embedding))
		}
		vectors[item.Index] = item.Embedding
	}

	for index, vector := range vectors {
		if len(vector) == 0 {
			return nil, fmt.Errorf("embedding vector missing at index %d", index)
		}
	}
	return vectors, nil
}

func readDashScopeAPIError(resp *http.Response) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return fmt.Errorf("dashscope embedding request failed with status %d", resp.StatusCode)
	}

	var parsed dashScopeErrorResponse
	if err := json.Unmarshal(body, &parsed); err == nil {
		message := firstNonEmptyString(parsed.Message, parsed.Output.Message, parsed.Error.Message)
		code := firstNonEmptyString(parsed.Code, parsed.Error.Code)
		if message != "" {
			if code != "" {
				return fmt.Errorf("dashscope embedding request failed with status %d: %s: %s", resp.StatusCode, code, message)
			}
			return fmt.Errorf("dashscope embedding request failed with status %d: %s", resp.StatusCode, message)
		}
	}

	return fmt.Errorf("dashscope embedding request failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
