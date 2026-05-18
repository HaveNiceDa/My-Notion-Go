export const mobileDocumentsQueryKeys = {
  content: (documentId: string) => ["mobile", "documents", documentId, "content"] as const,
  detail: (documentId: string) => ["mobile", "documents", documentId, "detail"] as const,
  publicDetail: (publicId: string) => ["mobile", "public-documents", publicId] as const,
  search: (query: string) => ["mobile", "documents", "search", query] as const,
  trash: ["mobile", "documents", "trash"] as const,
  tree: ["mobile", "documents", "tree"] as const,
};
