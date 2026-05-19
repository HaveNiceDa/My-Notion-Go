export const mobileAIQueryKeys = {
  all: ["mobile", "ai"] as const,
  conversations: () => [...mobileAIQueryKeys.all, "conversations"] as const,
  messages: (conversationId: string) => [...mobileAIQueryKeys.all, "messages", conversationId] as const,
};
