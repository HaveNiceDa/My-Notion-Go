import { apiClient } from "@my-notion-go/api-client";

export const mobileApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? apiClient.baseUrl;
export const mobileWebBaseUrl = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? deriveLocalWebBaseUrl(mobileApiBaseUrl),
);

function deriveLocalWebBaseUrl(apiBaseUrl: string) {
  try {
    const url = new URL(apiBaseUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.port = "5273";
      return url.toString();
    }
  } catch {
    // Keep the public link deterministic even when the API URL is misconfigured during local development.
  }

  return apiBaseUrl;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}
