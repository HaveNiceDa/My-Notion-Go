import { publicDocumentApi } from "@my-notion-go/api-client";
import { useQuery } from "@tanstack/react-query";
import { mobileDocumentsQueryKeys } from "./query-keys";

export function useMobilePublicDocument(publicId: string) {
  return useQuery({
    enabled: Boolean(publicId),
    queryKey: mobileDocumentsQueryKeys.publicDetail(publicId),
    queryFn: () => publicDocumentApi.get(publicId),
  });
}
