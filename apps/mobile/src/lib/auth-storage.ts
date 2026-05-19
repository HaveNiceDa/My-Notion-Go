import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const refreshTokenKey = "my-notion-go.refresh-token";
let memoryRefreshToken: string | null = null;

function getWebRefreshToken() {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(refreshTokenKey);
}

function setWebRefreshToken(refreshToken: string) {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(refreshTokenKey, refreshToken);
}

function clearWebRefreshToken() {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(refreshTokenKey);
}

async function canUseSecureStore() {
  return SecureStore.isAvailableAsync().catch(() => false);
}

export const authStorage = {
  async getRefreshToken() {
    if (Platform.OS === "web") {
      return memoryRefreshToken ?? getWebRefreshToken();
    }
    if (!(await canUseSecureStore())) {
      return memoryRefreshToken;
    }
    return SecureStore.getItemAsync(refreshTokenKey);
  },

  async setRefreshToken(refreshToken: string) {
    memoryRefreshToken = refreshToken;
    if (Platform.OS === "web") {
      setWebRefreshToken(refreshToken);
      return;
    }
    if (!(await canUseSecureStore())) {
      return;
    }
    await SecureStore.setItemAsync(refreshTokenKey, refreshToken);
  },

  async clearRefreshToken() {
    memoryRefreshToken = null;
    if (Platform.OS === "web") {
      clearWebRefreshToken();
      return;
    }
    if (!(await canUseSecureStore())) {
      return;
    }
    await SecureStore.deleteItemAsync(refreshTokenKey);
  },
};
