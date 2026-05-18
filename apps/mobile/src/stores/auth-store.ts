import { authStorage } from "@/lib/auth-storage";
import { ApiError, authApi, type AuthResult, type User } from "@my-notion-go/api-client";
import { Platform } from "react-native";
import { create } from "zustand";

type AuthStatus = "restoring" | "authenticated" | "unauthenticated";

type AuthState = {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  error: ApiError | null;
  status: AuthStatus;
  user: User | null;
  clearError: () => void;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthResult | null>;
  register: (input: { email: string; name?: string; password: string }) => Promise<void>;
  restoreSession: () => Promise<void>;
  runWithAuth: <T>(operation: (accessToken: string) => Promise<T>) => Promise<T>;
};

let refreshPromise: Promise<AuthResult | null> | null = null;

function getDeviceName() {
  return `Expo ${Platform.OS}`;
}

async function persistSession(result: AuthResult) {
  await authStorage.setRefreshToken(result.tokens.refreshToken);
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError("Network request failed.", 0, "NETWORK_ERROR");
}

export const useAuthStore = create<AuthState>((set, get) => {
  const commitSession = async (result: AuthResult) => {
    await persistSession(result);
    set({
      accessToken: result.tokens.accessToken,
      accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
      error: null,
      status: "authenticated",
      user: result.user,
    });
  };

  const clearSession = async () => {
    await authStorage.clearRefreshToken();
    set({
      accessToken: null,
      accessTokenExpiresAt: null,
      status: "unauthenticated",
      user: null,
    });
  };

  return {
    accessToken: null,
    accessTokenExpiresAt: null,
    error: null,
    status: "restoring",
    user: null,

    clearError() {
      set({ error: null });
    },

    async login(input) {
      set({ error: null });
      try {
        const result = await authApi.login({ ...input, deviceName: getDeviceName() });
        await commitSession(result);
      } catch (error) {
        const apiError = toApiError(error);
        set({ error: apiError, status: "unauthenticated" });
        throw apiError;
      }
    },

    async logout() {
      const refreshToken = await authStorage.getRefreshToken();
      await clearSession();
      if (!refreshToken) {
        return;
      }
      await authApi.logout(refreshToken).catch(() => undefined);
    },

    async refreshSession() {
      if (refreshPromise) {
        return refreshPromise;
      }

      refreshPromise = (async () => {
        const refreshToken = await authStorage.getRefreshToken();
        if (!refreshToken) {
          await clearSession();
          return null;
        }

        try {
          const result = await authApi.refresh(refreshToken);
          await commitSession(result);
          return result;
        } catch (error) {
          set({ error: toApiError(error) });
          await clearSession();
          return null;
        }
      })().finally(() => {
        refreshPromise = null;
      });

      return refreshPromise;
    },

    async register(input) {
      set({ error: null });
      try {
        const result = await authApi.register(input);
        await commitSession(result);
      } catch (error) {
        const apiError = toApiError(error);
        set({ error: apiError, status: "unauthenticated" });
        throw apiError;
      }
    },

    async restoreSession() {
      set({ error: null, status: "restoring" });
      await get().refreshSession();
    },

    async runWithAuth(operation) {
      const accessToken = get().accessToken;
      if (!accessToken) {
        const restored = await get().refreshSession();
        if (!restored) {
          throw new ApiError("Authentication required.", 401, "UNAUTHORIZED");
        }
        return operation(restored.tokens.accessToken);
      }

      try {
        return await operation(accessToken);
      } catch (error) {
        const apiError = toApiError(error);
        if (apiError.status !== 401) {
          throw apiError;
        }

        // A protected request gets exactly one refresh + retry to avoid looping on invalid sessions.
        const restored = await get().refreshSession();
        if (!restored) {
          throw apiError;
        }
        return operation(restored.tokens.accessToken);
      }
    },
  };
});
