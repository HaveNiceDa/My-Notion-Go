import { useAuthStore } from "@/stores/auth-store";
import { useQuery } from "@tanstack/react-query";
import { mobileAIApi } from "./mobile-ai-api";
import { mobileAIQueryKeys } from "./query-keys";

export function useMobileAIConversations() {
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  return useQuery({
    queryFn: () => runWithAuth((accessToken) => mobileAIApi.conversations(accessToken)),
    queryKey: mobileAIQueryKeys.conversations(),
  });
}
