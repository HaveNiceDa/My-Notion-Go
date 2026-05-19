import { useAuthStore } from "@/stores/auth-store";
import { useQuery } from "@tanstack/react-query";
import { mobileAIApi } from "./mobile-ai-api";
import { mobileAIQueryKeys } from "./query-keys";

export function useMobileAIMessages(conversationId: string) {
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  return useQuery({
    enabled: Boolean(conversationId),
    queryFn: () => runWithAuth((accessToken) => mobileAIApi.messages(conversationId, accessToken)),
    queryKey: mobileAIQueryKeys.messages(conversationId),
  });
}
