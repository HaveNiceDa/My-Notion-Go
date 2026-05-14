import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMemoizedFn, useMount, useRequest } from "ahooks";
import { ApiError, apiClient, authApi } from "@my-notion-go/api-client";
import { useAuthStore } from "./authStore";

type AuthMode = "login" | "register";
type AuthFormValues = {
  name: string;
  email: string;
  password: string;
};

const loginSchema = z.object({
  name: z.string(),
  email: z.email("请输入有效邮箱。"),
  password: z.string().min(1, "请输入密码。"),
});

const registerSchema = z.object({
  name: z.string(),
  email: z.email("请输入有效邮箱。"),
  password: z.string().min(8, "密码至少需要 8 位。"),
});

export function AuthShell() {
  return (
    <Routes>
      <Route element={<AuthBootstrap />}>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthPage mode="login" />} path="/login" />
          <Route element={<AuthPage mode="register" />} path="/register" />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<Dashboard />} path="/app" />
        </Route>
        <Route element={<Navigate replace to="/app" />} path="*" />
      </Route>
    </Routes>
  );
}

function AuthBootstrap() {
  const status = useAuthStore((state) => state.status);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  // 应用启动时恢复登录态；真实鉴权结果进入 Zustand，路由只根据 status 做跳转。
  useMount(() => {
    void restoreSession();
  });

  if (status === "checking") {
    return <LoadingScreen />;
  }

  return <Outlet />;
}

function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status);

  if (status === "authenticated") {
    return <Navigate replace to="/app" />;
  }

  return <Outlet />;
}

function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status !== "authenticated") {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}

function AuthPage({ mode }: { mode: AuthMode }) {
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const applyAuthResult = useAuthStore((state) => state.applyAuthResult);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<AuthFormValues>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
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
        setError("root", { message: toErrorMessage(error) });
      },
    },
  );

  // 表单校验交给 React Hook Form + Zod；请求生命周期交给 ahooks useRequest。
  const submitForm = useMemoizedFn((values: AuthFormValues) => {
    authRequest.run(values);
  });

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <p className="eyebrow">My-Notion Go Edition</p>
        <h1>{isLogin ? "欢迎回来" : "创建你的工作区账号"}</h1>
        <p className="muted-text">
          {isLogin ? "使用 Go Auth API 登录，并恢复你的访问令牌。" : "注册成功后会自动进入登录态。"}
        </p>

        <form className="auth-form" onSubmit={handleSubmit(submitForm)}>
          {!isLogin ? (
            <label>
              名称
              <input
                autoComplete="name"
                placeholder="Ada Lovelace"
                type="text"
                {...register("name")}
              />
            </label>
          ) : null}

          <label>
            邮箱
            <input
              autoComplete="email"
              placeholder="you@example.com"
              type="email"
              {...register("email")}
            />
            {errors.email?.message ? <span className="field-error">{errors.email.message}</span> : null}
          </label>

          <label>
            密码
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="至少 8 位"
              type="password"
              {...register("password")}
            />
            {errors.password?.message ? <span className="field-error">{errors.password.message}</span> : null}
          </label>

          {errors.root?.message ? <p className="form-error">{errors.root.message}</p> : null}

          <button className="primary-button" disabled={isSubmitting || authRequest.loading} type="submit">
            {isSubmitting || authRequest.loading ? "处理中..." : isLogin ? "登录" : "注册并登录"}
          </button>
        </form>

        <Link className="text-button" to={isLogin ? "/register" : "/login"}>
          {isLogin ? "还没有账号？去注册" : "已有账号？去登录"}
        </Link>
      </section>

      <aside className="auth-aside">
        <p className="eyebrow">API</p>
        <h2>{apiClient.baseUrl}</h2>
        <p>当前页面会调用注册、登录、刷新、退出和当前用户接口。</p>
      </aside>
    </main>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const logoutRequest = useRequest(logout, {
    manual: true,
    onFinally() {
      navigate("/login", { replace: true });
    },
  });
  const handleLogout = useMemoizedFn(() => {
    logoutRequest.run();
  });

  return (
    <main className="app-layout">
      <section className="hero-card dashboard-card">
        <p className="eyebrow">Protected Area</p>
        <h1>Auth 前端闭环已接入</h1>
        <p className="muted-text">只有登录用户才能进入这个临时 Dashboard。</p>

        <dl className="profile-list">
          <div>
            <dt>用户 ID</dt>
            <dd>{user?.id}</dd>
          </div>
          <div>
            <dt>邮箱</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>名称</dt>
            <dd>{user?.name || "未设置"}</dd>
          </div>
        </dl>

        <button className="secondary-button" disabled={logoutRequest.loading} onClick={handleLogout} type="button">
          {logoutRequest.loading ? "退出中..." : "退出登录"}
        </button>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="app-layout">
      <section className="hero-card">
        <p className="eyebrow">Loading</p>
        <h1>正在恢复登录态...</h1>
      </section>
    </main>
  );
}

// API 层会抛出 ApiError，组件层只负责把稳定的人类可读 message 展示出来。
function toErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "请求失败，请稍后重试。";
}
