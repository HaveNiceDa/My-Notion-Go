import { z } from "zod";
import type { TFunction } from "i18next";

// 登录和注册共用同一个表单组件，但两种模式的密码校验规则不同，所以 schema 通过工厂函数按当前语言生成。
export function createLoginSchema(t: TFunction) {
  return z.object({
    name: z.string(),
    email: z.email(t("auth.invalidEmail")),
    password: z.string().min(1, t("auth.requiredPassword")),
  });
}

export function createRegisterSchema(t: TFunction) {
  return z.object({
    name: z.string(),
    email: z.email(t("auth.invalidEmail")),
    password: z.string().min(8, t("auth.minPassword")),
  });
}
