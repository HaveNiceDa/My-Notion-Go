import { zodResolver } from "@hookform/resolvers/zod";
import { useMemoizedFn, useRequest } from "ahooks";
import { Loader2, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { authApi } from "@my-notion-go/api-client";
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
    <div className="auth-modal-backdrop" role="presentation">
      <section aria-modal="true" className="auth-modal" role="dialog">
        <button aria-label={t("auth.close")} className="icon-button close-button" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <div className="auth-modal-header">
          <img alt={t("common.brand")} className="auth-modal-logo light-logo" src="/logo.svg" />
          <img alt={t("common.brand")} className="auth-modal-logo dark-logo" src="/logo-dark.svg" />
          <h2>{isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}</h2>
          <p>{isLogin ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}</p>
        </div>

        <form className="auth-form modal-form" onSubmit={handleSubmit(submitForm)}>
          {!isLogin ? (
            <label>
              {t("auth.name")}
              <input autoComplete="name" placeholder={t("auth.namePlaceholder")} type="text" {...register("name")} />
            </label>
          ) : null}

          <label>
            {t("auth.email")}
            <input autoComplete="email" placeholder={t("auth.emailPlaceholder")} type="email" {...register("email")} />
            {errors.email?.message ? <span className="field-error">{errors.email.message}</span> : null}
          </label>

          <label>
            {t("auth.password")}
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={isLogin ? t("auth.loginPasswordPlaceholder") : t("auth.registerPasswordPlaceholder")}
              type="password"
              {...register("password")}
            />
            {errors.password?.message ? <span className="field-error">{errors.password.message}</span> : null}
          </label>

          {errors.root?.message ? <p className="form-error">{errors.root.message}</p> : null}

          <button className="primary-button full-width" disabled={isSubmitting || authRequest.loading} type="submit">
            {isSubmitting || authRequest.loading ? <Loader2 className="spin" size={16} /> : null}
            {isSubmitting || authRequest.loading ? t("auth.processing") : isLogin ? t("auth.loginSubmit") : t("auth.registerSubmit")}
          </button>
        </form>

        <p className="auth-switch-text">
          {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
          <button className="link-button" onClick={() => switchMode(isLogin ? "register" : "login")} type="button">
            {isLogin ? t("auth.signUp") : t("auth.signIn")}
          </button>
        </p>
      </section>
    </div>
  );
}
