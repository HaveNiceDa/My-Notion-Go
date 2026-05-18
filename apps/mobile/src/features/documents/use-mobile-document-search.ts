import { useAuthStore } from "@/stores/auth-store";
import { documentApi } from "@my-notion-go/api-client";
import { useQuery } from "@tanstack/react-query";
import { mobileDocumentsQueryKeys } from "./query-keys";

export function useMobileDocumentSearch(query: string) {
  const runWithAuth = useAuthStore((state) => state.runWithAuth);
  const normalizedQuery = query.trim();

  return useQuery({
    enabled: normalizedQuery.length > 0,
    queryKey: mobileDocumentsQueryKeys.search(normalizedQuery),
    queryFn: ({ signal }) =>
      runWithAuth((accessToken) =>
        documentApi.search(normalizedQuery, accessToken, {
          limit: 20,
          signal,
        }),
      ),
  });
}
