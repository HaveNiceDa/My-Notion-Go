export const mobileDocumentsQueryKeys = {
  content: (documentId: string) => ["mobile", "documents", documentId, "content"] as const,
  detail: (documentId: string) => ["mobile", "documents", documentId, "detail"] as const,
  tree: ["mobile", "documents", "tree"] as const,
};
