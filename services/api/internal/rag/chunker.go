package rag

import (
	"encoding/json"
	"regexp"
	"strings"
)

const (
	defaultChunkMaxRunes = 1200
	defaultChunkOverlap  = 120
)

var whitespacePattern = regexp.MustCompile(`\s+`)

type ChunkDraft struct {
	Content    string
	BlockIDs   []string
	Position   int
	TokenCount int
}

type blockNoteBlock struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Content  json.RawMessage  `json:"content"`
	Children []blockNoteBlock `json:"children"`
}

type inlineContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// BuildChunks 把 BlockNote JSONB 转为纯文本 chunk。
// M5.2 先做最小可用：提取 text inline content 和 string content，复杂表格/附件后续再扩展。
func BuildChunks(raw []byte, fallbackTitle string) ([]ChunkDraft, error) {
	text, blockIDs, err := PlainTextFromBlockNote(raw)
	if err != nil {
		return nil, err
	}
	if text == "" {
		text = strings.TrimSpace(fallbackTitle)
	}
	if text == "" {
		return nil, ErrNoIndexableContent
	}

	return splitTextIntoChunks(text, blockIDs), nil
}

// PlainTextFromBlockNote 保留 BlockNote block 顺序，把嵌套 children 递归展开。
// 返回 blockIDs 是为了后续在 RAG 引用里能反查来源 block。
func PlainTextFromBlockNote(raw []byte) (string, []string, error) {
	var blocks []blockNoteBlock
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return "", nil, ErrInvalidBlockNoteContent
	}

	var lines []string
	blockIDs := make([]string, 0, len(blocks))
	for _, block := range blocks {
		collectBlockText(block, &lines, &blockIDs)
	}

	text := normalizeText(strings.Join(lines, "\n"))
	return text, blockIDs, nil
}

func collectBlockText(block blockNoteBlock, lines *[]string, blockIDs *[]string) {
	if block.ID != "" {
		*blockIDs = append(*blockIDs, block.ID)
	}
	if text := extractBlockText(block.Content); text != "" {
		*lines = append(*lines, text)
	}
	for _, child := range block.Children {
		collectBlockText(child, lines, blockIDs)
	}
}

func extractBlockText(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}

	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return normalizeText(text)
	}

	var inlines []inlineContent
	if err := json.Unmarshal(raw, &inlines); err != nil {
		return ""
	}

	parts := make([]string, 0, len(inlines))
	for _, inline := range inlines {
		if inline.Text != "" {
			parts = append(parts, inline.Text)
		}
	}
	return normalizeText(strings.Join(parts, ""))
}

func splitTextIntoChunks(text string, blockIDs []string) []ChunkDraft {
	runes := []rune(text)
	if len(runes) <= defaultChunkMaxRunes {
		return []ChunkDraft{newChunkDraft(string(runes), blockIDs, 0)}
	}

	chunks := make([]ChunkDraft, 0, len(runes)/defaultChunkMaxRunes+1)
	for start := 0; start < len(runes); {
		end := start + defaultChunkMaxRunes
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, newChunkDraft(string(runes[start:end]), blockIDs, len(chunks)))
		if end == len(runes) {
			break
		}
		start = end - defaultChunkOverlap
		if start < 0 {
			start = 0
		}
	}
	return chunks
}

func newChunkDraft(content string, blockIDs []string, position int) ChunkDraft {
	content = normalizeText(content)
	return ChunkDraft{
		Content:    content,
		BlockIDs:   blockIDs,
		Position:   position,
		TokenCount: estimateTokenCount(content),
	}
}

func normalizeText(text string) string {
	return strings.TrimSpace(whitespacePattern.ReplaceAllString(text, " "))
}

func estimateTokenCount(text string) int {
	runeCount := len([]rune(text))
	if runeCount == 0 {
		return 0
	}
	// 粗略估算即可用于状态展示和后续成本预估；真实 tokenizer 后续再替换。
	return (runeCount + 3) / 4
}
