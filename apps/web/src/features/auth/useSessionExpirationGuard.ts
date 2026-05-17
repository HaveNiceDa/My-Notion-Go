import { useRef, useState } from "react";
import { useEventListener, useMemoizedFn } from "ahooks";
import { apiUnauthorizedEventName } from "@my-notion-go/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./authStore";

export function useSessionExpirationGuard() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const handlingUnauthorizedRef = useRef(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  const handleUnauthorized = useMemoizedFn(async () => {
    if (handlingUnauthorizedRef.current || sessionExpired) {
      return;
    }
    handlingUnauthorizedRef.current = true;
    try {
      const status = await refreshSession();
      if (status === "authenticated") {
        // 续期成功后让 React Query 重新拉取刚才可能因 401 失败的数据。
        void queryClient.invalidateQueries();
        return;
      }

      clearSession();
      setSessionExpired(true);
    } finally {
      handlingUnauthorizedRef.current = false;
    }
  });

  useEventListener(apiUnauthorizedEventName, () => {
    void handleUnauthorized();
  });

  const reloadPage = useMemoizedFn(() => {
    window.location.reload();
  });

  const relogin = useMemoizedFn(() => {
    clearSession();
    setSessionExpired(false);
    navigate("/login", { replace: true });
  });

  return {
    reloadPage,
    relogin,
    sessionExpired,
  };
}
