import { useQuery } from "@tanstack/react-query";
import { documentApi } from "@my-notion-go/api-client";
import { documentContentQueryKey } from "./queryKeys";

// useDocumentContent 只负责读取正文 JSON；标题等 metadata 仍由 DocumentWorkspace 单独查询。
export function useDocumentContent(documentId: string | undefined, accessToken: string) {
  return useQuery({
    queryKey: documentContentQueryKey(documentId),
    queryFn: () => documentApi.content(documentId!, accessToken),
    enabled: Boolean(documentId && accessToken),
  });
}
