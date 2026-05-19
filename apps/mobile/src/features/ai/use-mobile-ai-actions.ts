import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileAIApi } from "./mobile-ai-api";
import { mobileAIQueryKeys } from "./query-keys";

export function useMobileAIActions() {
  const queryClient = useQueryClient();
  const runWithAuth = useAuthStore((state) => state.runWithAuth);

  const createConversation = useMutation({
    mutationFn: (title?: string) =>
      runWithAuth((accessToken) => mobileAIApi.createConversation(title ? { title } : {}, accessToken)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mobileAIQueryKeys.conversations() });
    },
  });

  return {
    createConversation,
  };
}
