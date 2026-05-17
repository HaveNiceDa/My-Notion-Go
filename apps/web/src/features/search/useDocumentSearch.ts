import { useQuery } from "@tanstack/react-query";
import { documentApi } from "@my-notion-go/api-client";
import { documentSearchQueryKey } from "./queryKeys";

export function useDocumentSearch(query: string, accessToken: string, enabled: boolean) {
  const normalizedQuery = normalizeSearchQuery(query);

  return useQuery({
    queryKey: documentSearchQueryKey(normalizedQuery),
    // React Query 会在输入继续变化时 abort 旧请求，避免慢响应覆盖新搜索词的结果。
    queryFn: ({ signal }) => documentApi.search(normalizedQuery, accessToken, { limit: 20, signal }),
    enabled: enabled && Boolean(accessToken && normalizedQuery),
    staleTime: 10_000,
  });
}

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}
