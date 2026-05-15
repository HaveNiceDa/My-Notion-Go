import { z } from "zod";

// 登录和注册共用同一个表单组件，但两种模式的密码校验规则不同，所以 schema 单独集中维护。
export const loginSchema = z.object({
  name: z.string(),
  email: z.email("请输入有效邮箱。"),
  password: z.string().min(1, "请输入密码。"),
});

export const registerSchema = z.object({
  name: z.string(),
  email: z.email("请输入有效邮箱。"),
  password: z.string().min(8, "密码至少需要 8 位。"),
});
