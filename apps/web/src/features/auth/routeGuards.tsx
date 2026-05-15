import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./authStore";

// PublicOnlyRoute 阻止已登录用户回到登录/注册页，和 Clerk 的公开页访问规则保持一致。
export function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status);

  if (status === "authenticated") {
    return <Navigate replace to="/app" />;
  }

  return <Outlet />;
}

// ProtectedRoute 保护工作区页面；未登录用户会被送回首页并打开登录入口。
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status !== "authenticated") {
    return <Navigate replace state={{ from: location.pathname }} to="/" />;
  }

  return <Outlet />;
}
