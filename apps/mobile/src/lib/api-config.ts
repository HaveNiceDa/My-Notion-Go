import { apiClient } from "@my-notion-go/api-client";

export const mobileApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? apiClient.baseUrl;
