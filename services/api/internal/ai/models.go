package ai

const DefaultModelID = "deepseek-v4-pro"

type Model struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}

// AvailableModels 是后端认可的模型白名单，避免前端传入任意模型名造成不可控调用。
var AvailableModels = []Model{
	{
		ID:          "deepseek-v4-pro",
		DisplayName: "DeepSeek V4 Pro",
		Description: "默认推理模型，适合日常对话和复杂问题。",
	},
	{
		ID:          "qwen3.6-27b",
		DisplayName: "Qwen 3.6 27B",
		Description: "通义千问模型，适合中文内容处理。",
	},
	{
		ID:          "kimi-k2.6",
		DisplayName: "Kimi K2.6",
		Description: "长文本理解模型，适合阅读和总结。",
	},
	{
		ID:          "glm-5.1",
		DisplayName: "GLM 5.1",
		Description: "通用对话模型，适合快速问答。",
	},
}

func NormalizeModelID(modelID string) (string, bool) {
	if modelID == "" {
		return DefaultModelID, true
	}
	for _, model := range AvailableModels {
		if model.ID == modelID {
			return model.ID, true
		}
	}
	return "", false
}
