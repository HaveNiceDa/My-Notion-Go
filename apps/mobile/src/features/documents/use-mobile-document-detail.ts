import { useAuthStore } from "@/stores/auth-store";
import { documentApi } from "@my-notion-go/api-client";
import { useQuery } from "@tanstack/react-query";
import { mobileDocumentsQueryKeys } from "./query-keys";

export function useMobileDocumentDetail(documentId: string) {
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  return useQuery({
    enabled: Boolean(documentId),
    queryKey: mobileDocumentsQueryKeys.detail(documentId),
    queryFn: () => runWithAuth((accessToken) => documentApi.get(documentId, accessToken)),
  });
}

export function useMobileDocumentContent(documentId: string) {
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  return useQuery({
    enabled: Boolean(documentId),
    queryKey: mobileDocumentsQueryKeys.content(documentId),
    queryFn: () => runWithAuth((accessToken) => documentApi.content(documentId, accessToken)),
  });
}
