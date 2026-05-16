export const aiConversationsQueryKey = ["ai-chat", "conversations"] as const;

export function aiMessagesQueryKey(conversationId: string | undefined) {
  return ["ai-chat", "messages", conversationId ?? "none"] as const;
}
