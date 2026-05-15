import { useMemoizedFn, useRequest } from "ahooks";
import { useNavigate } from "react-router-dom";
import { DocumentWorkspace } from "../documents/DocumentWorkspace";
import { useAuthStore } from "./authStore";

// AuthenticatedWorkspace 只负责把退出登录流程注入工作区，DocumentWorkspace 不需要知道 Auth store 细节。
export function AuthenticatedWorkspace() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const logoutRequest = useRequest(logout, {
    manual: true,
    onFinally() {
      navigate("/", { replace: true });
    },
  });
  const handleLogout = useMemoizedFn(() => {
    logoutRequest.run();
  });

  return <DocumentWorkspace logoutLoading={logoutRequest.loading} onLogout={handleLogout} />;
}
