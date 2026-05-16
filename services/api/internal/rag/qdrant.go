package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultQdrantTimeout = 30 * time.Second

// QdrantConfig 描述本地或云端 Qdrant 的连接配置。
// APIKey 为空时按本地开发模式访问，不会额外设置鉴权 header。
type QdrantConfig struct {
	BaseURL string
	APIKey  string
	Timeout time.Duration
}

// QdrantClient 只封装 RAG 当前阶段需要的向量库能力。
// 后续 upsert/search/delete 会继续放在这里，避免业务 Service 直接拼 HTTP 请求。
type QdrantClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type createCollectionRequest struct {
	Vectors qdrantVectorParams `json:"vectors"`
}

type qdrantVectorParams struct {
	Size     int    `json:"size"`
	Distance string `json:"distance"`
}

func NewQdrantClient(cfg QdrantConfig) *QdrantClient {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultQdrantTimeout
	}

	return &QdrantClient{
		baseURL: strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/"),
		apiKey:  strings.TrimSpace(cfg.APIKey),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *QdrantClient) Enabled() bool {
	return c != nil && c.baseURL != ""
}

// Health 用于启动阶段快速探测 Qdrant 是否可访问。
// M5.0 暂不把 Qdrant 作为 API 强依赖，调用方可以选择记录 warning 后继续启动。
func (c *QdrantClient) Health(ctx context.Context) error {
	if !c.Enabled() {
		return fmt.Errorf("qdrant client is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/healthz", nil)
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return qdrantStatusError("qdrant health check failed", resp)
	}
	return nil
}

// EnsureCollection 确保指定 collection 存在。
// 先 GET 再 PUT，避免已有 collection 时重复创建造成 409 干扰本地启动。
func (c *QdrantClient) EnsureCollection(ctx context.Context, collection string, dimension int) error {
	if !c.Enabled() {
		return fmt.Errorf("qdrant client is not configured")
	}
	collection = strings.TrimSpace(collection)
	if collection == "" || dimension <= 0 {
		return fmt.Errorf("invalid qdrant collection config")
	}

	exists, err := c.collectionExists(ctx, collection)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	body, err := json.Marshal(createCollectionRequest{
		Vectors: qdrantVectorParams{
			Size:     dimension,
			Distance: "Cosine",
		},
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.collectionURL(collection), bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return qdrantStatusError("create qdrant collection failed", resp)
	}
	return nil
}

func (c *QdrantClient) collectionExists(ctx context.Context, collection string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.collectionURL(collection), nil)
	if err != nil {
		return false, err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusNotFound:
		return false, nil
	default:
		return false, qdrantStatusError("check qdrant collection failed", resp)
	}
}

func (c *QdrantClient) collectionURL(collection string) string {
	return c.baseURL + "/collections/" + url.PathEscape(collection)
}

func (c *QdrantClient) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}
}

func qdrantStatusError(message string, resp *http.Response) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return fmt.Errorf("%s with status %d", message, resp.StatusCode)
	}
	return fmt.Errorf("%s with status %d: %s", message, resp.StatusCode, strings.TrimSpace(string(body)))
}
