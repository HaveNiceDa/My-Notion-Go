import { Outlet } from "react-router-dom";
import { useMount } from "ahooks";
import { useThemeStore } from "../theme/themeStore";
import { useAuthStore } from "./authStore";
import { LoadingScreen } from "./LoadingScreen";
import { SessionExpiredDialog } from "./SessionExpiredDialog";
import { useSessionExpirationGuard } from "./useSessionExpirationGuard";

// AuthBootstrap 是应用启动层：先恢复主题，再恢复 token 登录态，路由组件无需关心启动顺序。
export function AuthBootstrap() {
  const status = useAuthStore((state) => state.status);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const initTheme = useThemeStore((state) => state.init);
  const sessionExpiration = useSessionExpirationGuard();

  // 应用启动时恢复主题和登录态。主题先落到 documentElement，避免页面进入后再闪烁切色。
  useMount(() => {
    initTheme();
    void restoreSession();
  });

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return (
    <>
      <Outlet />
      <SessionExpiredDialog
        onReload={sessionExpiration.reloadPage}
        onRelogin={sessionExpiration.relogin}
        open={sessionExpiration.sessionExpired}
      />
    </>
  );
}
