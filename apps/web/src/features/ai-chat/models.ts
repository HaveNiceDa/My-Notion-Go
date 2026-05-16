export const defaultAIModelId = "deepseek-v4-pro";
export const aiModelStorageKey = "my-notion-go.ai-chat.model";

export const aiModels = [
  {
    id: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    descriptionKey: "aiChat.models.deepseek-v4-pro",
  },
  {
    id: "qwen3.6-27b",
    displayName: "Qwen 3.6 27B",
    descriptionKey: "aiChat.models.qwen3.6-27b",
  },
  {
    id: "kimi-k2.6",
    displayName: "Kimi K2.6",
    descriptionKey: "aiChat.models.kimi-k2.6",
  },
  {
    id: "glm-5.1",
    displayName: "GLM 5.1",
    descriptionKey: "aiChat.models.glm-5.1",
  },
] as const;

export type AIModelId = (typeof aiModels)[number]["id"];

export function isAIModelId(value: string): value is AIModelId {
  return aiModels.some((model) => model.id === value);
}

export function getInitialAIModelId(): AIModelId {
  const stored = window.localStorage.getItem(aiModelStorageKey);
  return stored && isAIModelId(stored) ? stored : defaultAIModelId;
}
