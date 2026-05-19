import { useAuthStore } from "@/stores/auth-store";
import { documentApi, type Document, type UpdateDocumentRequest } from "@my-notion-go/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileDocumentsQueryKeys } from "./query-keys";

export function useMobileDocumentActions(documentId: string) {
  const queryClient = useQueryClient();
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  function syncDocumentCaches(document: Document) {
    // 元信息编辑会影响详情、列表、搜索和公开页入口，这里集中同步跨页面缓存。
    queryClient.setQueryData(mobileDocumentsQueryKeys.detail(document.id), document);
    void queryClient.invalidateQueries({ queryKey: mobileDocumentsQueryKeys.tree });
    void queryClient.invalidateQueries({ queryKey: ["mobile", "documents", "search"] });
    void queryClient.invalidateQueries({ queryKey: mobileDocumentsQueryKeys.publicDetail(document.publicId) });
  }

  const updateMetadataMutation = useMutation({
    mutationFn: (input: UpdateDocumentRequest) =>
      runWithAuth((accessToken) => documentApi.update(documentId, input, accessToken)),
    onSuccess: syncDocumentCaches,
  });

  const toggleStarMutation = useMutation({
    mutationFn: (document: Document) =>
      runWithAuth((accessToken) => documentApi.update(document.id, { isStarred: !document.isStarred }, accessToken)),
    onSuccess: syncDocumentCaches,
  });

  const togglePublishMutation = useMutation({
    mutationFn: (document: Document) =>
      runWithAuth((accessToken) =>
        document.isPublished ? documentApi.unpublish(document.id, accessToken) : documentApi.publish(document.id, accessToken),
      ),
    onSuccess: syncDocumentCaches,
  });

  return {
    togglePublishMutation,
    toggleStarMutation,
    updateMetadataMutation,
  };
}
