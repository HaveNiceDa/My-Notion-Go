// Document query keys 统一放在这里，避免不同组件手写 cache key 导致缓存失效不一致。
export const documentsQueryKey = ["documents", "tree"] as const;
export const documentsTrashQueryKey = ["documents", "trash"] as const;

export function documentQueryKey(documentId?: string) {
  return ["documents", documentId] as const;
}

export function documentContentQueryKey(documentId?: string) {
  return ["documents", documentId, "content"] as const;
}
