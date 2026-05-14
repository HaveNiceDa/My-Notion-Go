import type { TokenPair } from "@my-notion-go/api-client";

const accessTokenKey = "my-notion-go.access-token";
const refreshTokenKey = "my-notion-go.refresh-token";

export type StoredTokens = Pick<TokenPair, "accessToken" | "refreshToken">;

// MVP 阶段先把 token 存在 localStorage，所有读写都收敛在这里，后续可平滑替换为更安全的存储方案。
export const authStorage = {
  getTokens(): StoredTokens | null {
    const accessToken = window.localStorage.getItem(accessTokenKey);
    const refreshToken = window.localStorage.getItem(refreshTokenKey);

    // access token 和 refresh token 必须成对存在，否则视为登录态不完整并重新登录。
    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  },

  setTokens(tokens: StoredTokens) {
    window.localStorage.setItem(accessTokenKey, tokens.accessToken);
    window.localStorage.setItem(refreshTokenKey, tokens.refreshToken);
  },

  clearTokens() {
    window.localStorage.removeItem(accessTokenKey);
    window.localStorage.removeItem(refreshTokenKey);
  },
};
