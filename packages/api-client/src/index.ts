const defaultBaseUrl = "http://localhost:8080";
const viteEnv = (import.meta as unknown as {
  env?: Record<string, string | undefined>;
}).env;

export const apiClient = {
  baseUrl: viteEnv?.VITE_API_BASE_URL ?? defaultBaseUrl,
};
