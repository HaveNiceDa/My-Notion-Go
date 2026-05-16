package ai

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseStreamCollectsContentDeltas(t *testing.T) {
	// 验证基础 SSE 解析能力：多个 data 帧应该按顺序拼接，遇到 [DONE] 后正常结束。
	stream := strings.NewReader(strings.Join([]string{
		`data: {"choices":[{"delta":{"content":"Hello"}}]}`,
		"",
		`data: {"choices":[{"delta":{"content":" world"}}]}`,
		"",
		"data: [DONE]",
		"",
	}, "\n"))

	var result strings.Builder
	if err := parseStream(stream, func(delta string) error {
		result.WriteString(delta)
		return nil
	}); err != nil {
		t.Fatalf("parseStream returned error: %v", err)
	}

	if result.String() != "Hello world" {
		t.Fatalf("unexpected streamed content: %q", result.String())
	}
}

func TestClientEnabledRequiresAllRuntimeConfig(t *testing.T) {
	// 验证真实 LLM 客户端的启用条件：必须同时具备服务端密钥和 base URL，避免误走半配置状态。
	client := NewClient(Config{
		APIKey:  "key",
		BaseURL: "https://example.com/v1",
	})
	if !client.Enabled() {
		t.Fatal("client should be enabled when api key and base url are set")
	}

	disabled := NewClient(Config{
		BaseURL: "https://example.com/v1",
	})
	if disabled.Enabled() {
		t.Fatal("client should stay disabled without api key")
	}
}

func TestClientStreamChatSendsSelectedModel_BitsUT(t *testing.T) {
	// 验证前端选择的模型会进入 OpenAI-compatible 请求体，并且响应 delta 会被顺序转发给调用方。
	t.Run("使用请求传入的模型发起流式聊天", func(t *testing.T) {
		var capturedRequest string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 用 httptest 模拟兼容 OpenAI 的上游服务，既能断言请求体，也不会消耗真实模型额度。
			if r.URL.Path != "/chat/completions" {
				t.Fatalf("unexpected request path: %s", r.URL.Path)
			}
			if got := r.Header.Get("Authorization"); got != "Bearer key" {
				t.Fatalf("unexpected authorization header: %s", got)
			}
			if got := r.Header.Get("Accept"); got != "text/event-stream" {
				t.Fatalf("unexpected accept header: %s", got)
			}

			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("failed to read request body: %v", err)
			}
			capturedRequest = string(body)

			w.Header().Set("Content-Type", "text/event-stream")
			// 分两段 delta 返回，验证 parseStream 会按 SSE 帧顺序累加 assistant 内容。
			_, _ = w.Write([]byte(strings.Join([]string{
				`data: {"choices":[{"delta":{"content":"你好"}}]}`,
				"",
				`data: {"choices":[{"delta":{"content":"，世界"}}]}`,
				"",
				"data: [DONE]",
				"",
			}, "\n")))
		}))
		defer server.Close()

		client := NewClient(Config{
			APIKey:  " key ",
			BaseURL: server.URL + "/",
		})

		var response strings.Builder
		metadata, err := client.StreamChat(context.Background(), "kimi-k2.6", []Message{{Role: "user", Content: "hello"}}, func(delta string) error {
			response.WriteString(delta)
			return nil
		})
		if err != nil {
			t.Fatalf("StreamChat returned error: %v", err)
		}
		if !strings.Contains(capturedRequest, `"model":"kimi-k2.6"`) {
			t.Fatalf("request body should contain selected model, got: %s", capturedRequest)
		}
		if !strings.Contains(capturedRequest, `"stream":true`) {
			t.Fatalf("request body should enable streaming, got: %s", capturedRequest)
		}
		if response.String() != "你好，世界" {
			t.Fatalf("unexpected streamed response: %q", response.String())
		}
		if metadata.Provider != "openai-compatible" || metadata.Model != "kimi-k2.6" {
			t.Fatalf("unexpected metadata: %+v", metadata)
		}
	})
}

func TestClientStreamChatReturnsUpstreamError_BitsUT(t *testing.T) {
	// 验证上游非 2xx 响应不会被吞掉，错误信息需要保留下来供前端 AI 面板展示。
	t.Run("上游返回错误 JSON 时透传错误信息", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			// DashScope 等 OpenAI-compatible 服务会把额度/鉴权错误放进 error.message，客户端需要保留给 UI 展示。
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"error":{"message":"quota exhausted","type":"quota","code":"FreeTierOnly"}}`))
		}))
		defer server.Close()

		client := NewClient(Config{
			APIKey:  "key",
			BaseURL: server.URL,
		})

		_, err := client.StreamChat(context.Background(), "deepseek-v4-pro", []Message{{Role: "user", Content: "hello"}}, func(string) error {
			return nil
		})
		if err == nil {
			t.Fatal("expected upstream error")
		}
		if !strings.Contains(err.Error(), "quota exhausted") {
			t.Fatalf("expected upstream message in error, got: %v", err)
		}
	})
}

func TestClientStreamChatPropagatesDeltaCallbackError_BitsUT(t *testing.T) {
	// 验证下游写 SSE 失败时会立即中断上游读取，避免浏览器断开后服务端继续消耗模型流。
	t.Run("delta 回调失败时终止流式解析", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}\n\n"))
		}))
		defer server.Close()

		client := NewClient(Config{
			APIKey:  "key",
			BaseURL: server.URL,
		})
		expected := errors.New("callback failed")

		// onDelta 失败通常意味着下游 SSE 写回浏览器失败，必须立刻向上返回错误，避免继续读上游流。
		_, err := client.StreamChat(context.Background(), "glm-5.1", []Message{{Role: "user", Content: "hello"}}, func(string) error {
			return expected
		})
		if !errors.Is(err, expected) {
			t.Fatalf("expected callback error, got: %v", err)
		}
	})
}
