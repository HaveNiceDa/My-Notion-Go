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

type QdrantPoint struct {
	ID      string
	Vector  []float32
	Payload map[string]any
}

type upsertPointsRequest struct {
	Points []upsertPoint `json:"points"`
}

type upsertPoint struct {
	ID      string         `json:"id"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload,omitempty"`
}

type deletePointsRequest struct {
	Points []string `json:"points"`
}

type searchPointsRequest struct {
	Vector      []float32    `json:"vector"`
	Limit       int          `json:"limit"`
	WithPayload bool         `json:"with_payload"`
	Filter      qdrantFilter `json:"filter"`
}

type qdrantFilter struct {
	Must []qdrantCondition `json:"must,omitempty"`
}

type qdrantCondition struct {
	Key   string      `json:"key"`
	Match qdrantMatch `json:"match"`
}

type qdrantMatch struct {
	Value any `json:"value"`
}

type searchPointsResponse struct {
	Result []qdrantSearchPoint `json:"result"`
}

type qdrantSearchPoint struct {
	ID      json.RawMessage `json:"id"`
	Score   float64         `json:"score"`
	Payload map[string]any  `json:"payload"`
}

type SearchResult struct {
	ID         string
	Score      float64
	UserID     string
	DocumentID string
	ChunkID    string
	Position   int
	Text       string
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

// UpsertPoints 写入或覆盖 Qdrant points。
// point id 由 rag_chunks.qdrant_point_id 持久化，后续重建索引和关闭知识库时可以精准删除。
func (c *QdrantClient) UpsertPoints(ctx context.Context, collection string, points []QdrantPoint) error {
	if !c.Enabled() {
		return fmt.Errorf("qdrant client is not configured")
	}
	if strings.TrimSpace(collection) == "" || len(points) == 0 {
		return fmt.Errorf("invalid qdrant upsert input")
	}

	payload := upsertPointsRequest{Points: make([]upsertPoint, 0, len(points))}
	for _, point := range points {
		if point.ID == "" || len(point.Vector) == 0 {
			return fmt.Errorf("invalid qdrant point")
		}
		payload.Points = append(payload.Points, upsertPoint{
			ID:      point.ID,
			Vector:  point.Vector,
			Payload: point.Payload,
		})
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.collectionURL(collection)+"/points?wait=true", bytes.NewReader(body))
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
		return qdrantStatusError("upsert qdrant points failed", resp)
	}
	return nil
}

// DeletePoints 删除指定 point id 列表。
// 关闭知识库和重建索引都会先清理旧 point，避免 Qdrant 中残留过期 chunk。
func (c *QdrantClient) DeletePoints(ctx context.Context, collection string, pointIDs []string) error {
	if !c.Enabled() {
		return fmt.Errorf("qdrant client is not configured")
	}
	if strings.TrimSpace(collection) == "" || len(pointIDs) == 0 {
		return nil
	}

	body, err := json.Marshal(deletePointsRequest{Points: pointIDs})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.collectionURL(collection)+"/points/delete?wait=true", bytes.NewReader(body))
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
		return qdrantStatusError("delete qdrant points failed", resp)
	}
	return nil
}

// SearchByUser 在当前用户的 point 范围内做相似度检索。
// userId filter 是 RAG 的关键安全边界，避免不同用户的 chunks 被混入同一次回答上下文。
func (c *QdrantClient) SearchByUser(ctx context.Context, collection string, userID string, vector []float32, limit int) ([]SearchResult, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("qdrant client is not configured")
	}
	collection = strings.TrimSpace(collection)
	userID = strings.TrimSpace(userID)
	if collection == "" || userID == "" || len(vector) == 0 {
		return nil, fmt.Errorf("invalid qdrant search input")
	}
	if limit <= 0 {
		limit = 5
	}

	body, err := json.Marshal(searchPointsRequest{
		Vector:      vector,
		Limit:       limit,
		WithPayload: true,
		Filter: qdrantFilter{
			Must: []qdrantCondition{
				{
					Key:   "userId",
					Match: qdrantMatch{Value: userID},
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.collectionURL(collection)+"/points/search", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, qdrantStatusError("search qdrant points failed", resp)
	}

	var parsed searchPointsResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(parsed.Result))
	for _, point := range parsed.Result {
		results = append(results, SearchResult{
			ID:         decodePointID(point.ID),
			Score:      point.Score,
			UserID:     payloadString(point.Payload, "userId"),
			DocumentID: payloadString(point.Payload, "documentId"),
			ChunkID:    payloadString(point.Payload, "chunkId"),
			Position:   payloadInt(point.Payload, "position"),
			Text:       payloadString(point.Payload, "text"),
		})
	}
	return results, nil
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

func decodePointID(raw json.RawMessage) string {
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return text
	}
	return strings.Trim(string(raw), `"`)
}

func payloadString(payload map[string]any, key string) string {
	value, ok := payload[key]
	if !ok {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

func payloadInt(payload map[string]any, key string) int {
	value, ok := payload[key]
	if !ok {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	default:
		return 0
	}
}
