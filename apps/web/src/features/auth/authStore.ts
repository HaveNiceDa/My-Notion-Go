import { create } from "zustand";
import { authApi, type AuthResult, type User } from "@my-notion-go/api-client";
import { authStorage } from "./authStorage";

// AuthStatus 表达登录态生命周期，而不是单纯的布尔值：
// checking 用于启动恢复登录态，authenticated/unauthenticated 用于路由守卫决策。
export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

// AuthState 是 Web 端 Auth 的全局状态中心。
// 它把“当前用户是谁、token 是什么、如何恢复/退出登录态”集中在 Zustand store 中，
// 避免 Login、Dashboard、Document 等页面各自维护一份不一致的登录状态。
type AuthState = {
  // status 是路由守卫的唯一判断来源，页面不要直接通过 token 是否存在来判断登录态。
  status: AuthStatus;
  // user 是后端 /me 返回的安全用户视图，后续文档归属、头像、设置入口都会读取它。
  user: User | null;
  // accessToken 只用于短期 API 鉴权，过期后由 refresh token 续期。
  accessToken: string;
  // refreshToken 用于恢复会话和退出登录，不应该散落到组件层直接读写。
  refreshToken: string;
  // applyAuthResult 统一处理注册、登录、刷新 token 后的状态落盘。
  applyAuthResult: (result: AuthResult) => void;
  // clearSession 是所有退出和恢复失败路径的统一清理入口。
  clearSession: () => void;
  // restoreSession 在应用启动时从持久化 token 恢复用户态，并在 access token 失效时尝试刷新。
  restoreSession: () => Promise<AuthStatus>;
  // logout 负责调用后端撤销 refresh token，并保证本地状态最终被清理。
  logout: () => Promise<void>;
};

let restorePromise: Promise<AuthStatus> | null = null;

// useAuthStore 是前端 Auth 的单一事实来源。
// 组件只订阅需要的状态和 action，token 存储、刷新、清理等副作用都收敛在这里。
export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  user: null,
  accessToken: "",
  refreshToken: "",

  // 登录、注册、刷新 token 都返回 AuthResult，因此统一在 store 里落盘 token 和用户态。
  applyAuthResult(result) {
    authStorage.setTokens(result.tokens);
    set({
      status: "authenticated",
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  },

  clearSession() {
    authStorage.clearTokens();
    set({
      status: "unauthenticated",
      user: null,
      accessToken: "",
      refreshToken: "",
    });
  },

  restoreSession() {
    // React StrictMode 会在开发环境重复执行 effect；共享 Promise 可避免 refresh token 被重复轮换。
    if (restorePromise) {
      return restorePromise;
    }

    restorePromise = restoreStoredSession(set, get().applyAuthResult, get().clearSession).finally(() => {
      restorePromise = null;
    });

    return restorePromise;
  },

  async logout() {
    const refreshToken = get().refreshToken;

    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      // 后端退出失败也清理本地状态，避免用户继续停留在受保护页面。
      get().clearSession();
    }
  },
}));

// restoreStoredSession 封装启动恢复流程：先验证 access token，再用 refresh token 轮换兜底。
// 这样 AuthBootstrap 只需要触发 restoreSession，不需要理解 token 恢复的具体步骤。
async function restoreStoredSession(
  set: (state: Partial<AuthState>) => void,
  applyAuthResult: (result: AuthResult) => void,
  clearSession: () => void,
): Promise<AuthStatus> {
  const tokens = authStorage.getTokens();

  if (!tokens) {
    clearSession();
    return "unauthenticated";
  }

  try {
    const user = await authApi.me(tokens.accessToken);
    set({
      status: "authenticated",
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return "authenticated";
  } catch {
    try {
      const result = await authApi.refresh(tokens.refreshToken);
      applyAuthResult(result);
      return "authenticated";
    } catch {
      clearSession();
      return "unauthenticated";
    }
  }
}
