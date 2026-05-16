# M1 Auth + Database Foundation

## 阶段目标

完成 PostgreSQL migration、数据库健康检查、自研 JWT Auth 后端、前端登录注册与登录态恢复，让项目从“能启动”进入“有真实用户体系”的阶段。

## 后端能力

- 新增初始 migration：`users`、`refresh_tokens`、`documents`、`document_contents`。
- 实现轻量 migration runner：使用 `schema_migrations` 记录执行状态，每个 migration 独立事务执行。
- `cmd/migrate` 支持 `pnpm migrate:api` 和 `make migrate-api`。
- API 启动时连接 PostgreSQL，`/health` 同时检查数据库连通性。
- 新增统一响应结构：`success`、`data`、`error.code`、`error.message`。
- 实现 Auth repository/service/handler/token/middleware。
- 支持注册、登录、刷新 token、退出登录、当前用户读取。
- Access Token 使用 JWT HS256。
- Refresh Token 使用随机 token，数据库仅保存 SHA-256 hash。
- Refresh Token 支持轮换，旧 token 会失效，logout 会撤销 token。
- Gin 显式 `SetTrustedProxies(nil)`，避免默认信任所有代理。
- CORS 使用 `gin-contrib/cors`，默认只允许 `http://localhost:5273`，符合最小权限。

## 前端能力

- `packages/api-client` 支持后端统一响应解析和 `ApiError`。
- 新增 Auth API client 类型和方法。
- Auth token MVP 阶段使用 `localStorage` 保存，并封装在 `authStorage.ts`。
- 引入 React Router，替换手写 History 路由。
- 引入 Zustand 管理 Auth 状态和登录态恢复。
- 引入 React Hook Form + Zod 管理表单和校验。
- 引入 ahooks 的 `useMount`、`useRequest`、`useMemoizedFn` 管理生命周期、请求和稳定回调。
- 支持 `/login`、`/register`、`/app`，并实现 public-only / protected route guard。
- 前端登录态恢复支持 access token 校验和 refresh token 轮换。

## 手动验证

- 新增 `services/api/docs/auth.http`。
- 覆盖 `GET /health`、注册、登录、`GET /api/v1/me`、refresh、logout。
- 真实 PostgreSQL 环境验证通过：
  - migration 幂等。
  - 注册成功。
  - 登录成功。
  - 当前用户读取成功。
  - refresh token 轮换成功。
  - 旧 refresh token 失效。
  - logout 后 refresh token 失效。

## 关键产物

- `services/api/migrations/000001_initial_schema.up.sql`
- `services/api/internal/database/migrations.go`
- `services/api/internal/auth/*`
- `services/api/internal/middleware/auth.go`
- `services/api/internal/response/response.go`
- `services/api/docs/auth.http`
- `apps/web/src/features/auth/*`
- `packages/api-client/src/index.ts`

## 关键经验

- CORS middleware 必须注册在业务路由之前，否则浏览器 preflight 会失败。
- Refresh token 明文只返回给客户端，数据库只存 hash。
- React StrictMode 下登录态恢复可能重复执行，需要共享 `restorePromise` 避免重复轮换 refresh token。
- MVP 阶段 token 放 `localStorage` 简单可行，但后续安全强化时需要重新评估。

## 来源日志

- `progress/20260511-110328.md`
- `progress/20260512-224300.md`
- `progress/20260513-092606.md`
- `progress/20260514-220920.md`
- `progress/20260514-223108.md`
- `progress/20260514-231342.md`
- `progress/20260514-233517.md`
