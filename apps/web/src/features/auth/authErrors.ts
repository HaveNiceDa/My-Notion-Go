import { ApiError } from "@my-notion-go/api-client";

// API 层会抛出 ApiError；组件层只需要拿到稳定的人类可读 message。
export function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "请求失败，请稍后重试。";
}
