import { zodResolver } from "@hookform/resolvers/zod";
import { useMemoizedFn, useRequest } from "ahooks";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { authApi } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createLoginSchema, createRegisterSchema } from "./authSchemas";
import { toErrorMessage } from "./authErrors";
import { useAuthStore } from "./authStore";
import type { AuthFormValues, AuthMode } from "./types";

type AuthDialogProps = {
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
};

// AuthDialog 对齐原项目 Clerk 弹窗体验，但内部仍然调用 Go Auth API 完成登录/注册。
export function AuthDialog({ mode, onClose, onSwitchMode }: AuthDialogProps) {
  const { t } = useTranslation();
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const applyAuthResult = useAuthStore((state) => state.applyAuthResult);
  const schema = useMemo(() => (isLogin ? createLoginSchema(t) : createRegisterSchema(t)), [isLogin, t]);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<AuthFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });
  const authRequest = useRequest(
    (values: AuthFormValues) =>
      isLogin
        ? authApi.login({
            email: values.email,
            password: values.password,
            deviceName: window.navigator.userAgent,
          })
        : authApi.register({
            email: values.email,
            name: values.name,
            password: values.password,
          }),
    {
      manual: true,
      onSuccess(result) {
        applyAuthResult(result);
        navigate("/app", { replace: true });
      },
      onError(error) {
        setError("root", { message: toErrorMessage(error, t) });
      },
    },
  );

  // 表单校验交给 React Hook Form + Zod；请求生命周期交给 ahooks useRequest，避免组件手写 loading/error 状态。
  const submitForm = useMemoizedFn((values: AuthFormValues) => {
    authRequest.run(values);
  });
  const switchMode = useMemoizedFn((nextMode: AuthMode) => {
    onSwitchMode(nextMode);
    navigate(nextMode === "login" ? "/login" : "/register", { replace: true });
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="p-7">
        <DialogHeader className="mb-6 justify-items-center text-center">
          <img alt={t("common.brand")} className="light-logo size-9" src="/logo.svg" />
          <img alt={t("common.brand")} className="dark-logo size-9" src="/logo-dark.svg" />
          <DialogTitle className="mt-2 text-2xl">{isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}</DialogTitle>
          <DialogDescription>{isLogin ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
          {!isLogin ? (
            <label className="grid gap-2 text-sm font-medium text-foreground">
              <span>{t("auth.name")}</span>
              <Input autoComplete="name" placeholder={t("auth.namePlaceholder")} type="text" {...register("name")} />
            </label>
          ) : null}

          <label className="grid gap-2 text-sm font-medium text-foreground">
            <span>{t("auth.email")}</span>
            <Input autoComplete="email" placeholder={t("auth.emailPlaceholder")} type="email" {...register("email")} />
            {errors.email?.message ? <span className="m-0 text-sm text-[var(--danger)]">{errors.email.message}</span> : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            <span>{t("auth.password")}</span>
            <Input
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={isLogin ? t("auth.loginPasswordPlaceholder") : t("auth.registerPasswordPlaceholder")}
              type="password"
              {...register("password")}
            />
            {errors.password?.message ? <span className="m-0 text-sm text-[var(--danger)]">{errors.password.message}</span> : null}
          </label>

          {errors.root?.message ? (
            <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-muted)] px-3 py-2.5 text-sm text-[var(--danger)]">
              {errors.root.message}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting || authRequest.loading} type="submit">
            {isSubmitting || authRequest.loading ? <Loader2 className="animate-spin" size={16} /> : null}
            {isSubmitting || authRequest.loading ? t("auth.processing") : isLogin ? t("auth.loginSubmit") : t("auth.registerSubmit")}
          </Button>
        </form>

        <p className="mt-[18px] flex justify-center gap-1.5 text-sm text-muted-foreground">
          {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
          <Button className="h-auto p-0 font-semibold" onClick={() => switchMode(isLogin ? "register" : "login")} type="button" variant="link">
            {isLogin ? t("auth.signUp") : t("auth.signIn")}
          </Button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
