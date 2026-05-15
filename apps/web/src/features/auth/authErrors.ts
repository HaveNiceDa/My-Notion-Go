import type { TFunction } from "i18next";
import { ApiError } from "@my-notion-go/api-client";

// API 层会抛出 ApiError；组件层只需要拿到稳定的人类可读 message，并给未知错误走当前语言兜底文案。
export function toErrorMessage(error: unknown, t: TFunction) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t("auth.requestFailed");
}
