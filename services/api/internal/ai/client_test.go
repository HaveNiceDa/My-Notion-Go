package ai

import (
	"strings"
	"testing"
)

func TestParseStreamCollectsContentDeltas(t *testing.T) {
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
