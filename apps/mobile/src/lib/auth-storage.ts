import * as SecureStore from "expo-secure-store";

const refreshTokenKey = "my-notion-go.refresh-token";
let memoryRefreshToken: string | null = null;

async function canUseSecureStore() {
  return SecureStore.isAvailableAsync().catch(() => false);
}

export const authStorage = {
  async getRefreshToken() {
    if (!(await canUseSecureStore())) {
      return memoryRefreshToken;
    }
    return SecureStore.getItemAsync(refreshTokenKey);
  },

  async setRefreshToken(refreshToken: string) {
    memoryRefreshToken = refreshToken;
    if (!(await canUseSecureStore())) {
      return;
    }
    await SecureStore.setItemAsync(refreshTokenKey, refreshToken);
  },

  async clearRefreshToken() {
    memoryRefreshToken = null;
    if (!(await canUseSecureStore())) {
      return;
    }
    await SecureStore.deleteItemAsync(refreshTokenKey);
  },
};
