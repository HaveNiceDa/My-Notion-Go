import { Navigate, Route, Routes } from "react-router-dom";
import { AuthenticatedWorkspace } from "./AuthenticatedWorkspace";
import { AuthBootstrap } from "./AuthBootstrap";
import { MarketingHome } from "./MarketingHome";
import { ProtectedRoute, PublicOnlyRoute } from "./routeGuards";

// AuthShell 是前端路由装配层，只描述公开页、受保护页和兜底跳转，不承载具体页面 UI。
export function AuthShell() {
  return (
    <Routes>
      <Route element={<AuthBootstrap />}>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<MarketingHome />} path="/" />
          <Route element={<MarketingHome initialAuthMode="login" />} path="/login" />
          <Route element={<MarketingHome initialAuthMode="register" />} path="/register" />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedWorkspace />} path="/app" />
          <Route element={<AuthenticatedWorkspace />} path="/documents/:documentId" />
        </Route>
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
