import { useAuthStore } from "@/stores/auth-store";
import { documentApi } from "@my-notion-go/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileDocumentsQueryKeys } from "./query-keys";

export function useMobileTrashActions() {
  const queryClient = useQueryClient();
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  function invalidateDocumentLists(documentId: string) {
    // 回收站动作会改变文档可见性，需要同步刷新列表、搜索和详情缓存。
    void queryClient.invalidateQueries({ queryKey: mobileDocumentsQueryKeys.trash });
    void queryClient.invalidateQueries({ queryKey: mobileDocumentsQueryKeys.tree });
    void queryClient.invalidateQueries({ queryKey: ["mobile", "documents", "search"] });
    void queryClient.invalidateQueries({ queryKey: ["mobile", "documents", documentId] });
  }

  const restoreMutation = useMutation({
    mutationFn: (documentId: string) => runWithAuth((accessToken) => documentApi.restore(documentId, accessToken)),
    onSuccess: (_data, documentId) => invalidateDocumentLists(documentId),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => runWithAuth((accessToken) => documentApi.delete(documentId, accessToken)),
    onSuccess: (_data, documentId) => invalidateDocumentLists(documentId),
  });

  return {
    deleteMutation,
    restoreMutation,
  };
}
