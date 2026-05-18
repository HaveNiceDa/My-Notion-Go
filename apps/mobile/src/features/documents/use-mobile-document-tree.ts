import { useAuthStore } from "@/stores/auth-store";
import { documentApi } from "@my-notion-go/api-client";
import { useQuery } from "@tanstack/react-query";
import { mobileDocumentsQueryKeys } from "./query-keys";

export function useMobileDocumentTree() {
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  return useQuery({
    queryKey: mobileDocumentsQueryKeys.tree,
    queryFn: () => runWithAuth((accessToken) => documentApi.tree(accessToken)),
  });
}
