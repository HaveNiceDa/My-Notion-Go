# M7 Realtime + Deployment + Testing

## 阶段目标

M7 用于把当前单页 Notion-like MVP 推进到更完整的工程闭环：实时事件通知、部署准备、健康检查和测试补强。

本阶段优先从 `M7.0 SSE Realtime Events` 开始。第一版只实现单 API 进程内的用户级事件广播，不引入 Redis Pub/Sub，也不做多人协同编辑。

## 设计取舍

### 当前采用 SSE

- 复杂度低：浏览器和 Go API 都能直接支持流式事件。
- 符合现状：项目已有 AI/RAG SSE 经验，不需要额外 WebSocket 网关。
- 数据隔离明确：事件订阅必须经过 Bearer token 鉴权，并按 `userId` 订阅。
- 足够 MVP：文档树、回收站、收藏和发布状态变化后，前端只需要收到事件并 invalidate React Query cache。

### 暂不引入 WebSocket

- 暂不做多人协同编辑、在线光标、presence 等强实时能力。
- 暂不维护复杂连接状态和双向消息协议。
- 后续如果需要多实例广播，可先给 SSE hub 接 Redis Pub/Sub，再评估是否升级 WebSocket。

## M7.0 范围

- 后端：
  - 新增 `GET /api/v1/realtime/events`。
  - 新增 `internal/realtime` 模块，提供进程内 Hub、事件模型和 SSE Handler。
  - 事件订阅必须经过 `RequireAuth`，按当前用户 ID 隔离。
  - 文档创建、更新、收藏、收藏排序、发布、取消发布、归档、恢复、删除、正文保存成功后发布事件。
- 前端：
  - 新增 `useRealtimeEvents` hook。
  - 使用 `fetch` + `ReadableStream` 读取 SSE，继续携带 Bearer token。
  - 收到文档事件后 invalidate 文档树、回收站、文档详情、正文和搜索缓存。
- 验证：
  - `go test ./services/api/...`
  - `pnpm --filter @my-notion-go/web typecheck`
  - `pnpm build:api`

## M7.0 已知限制

- SSE 实时事件当前只解决“数据变化通知”和“缓存刷新”，不解决多人同时编辑同一篇文档时的操作冲突。
- 正文保存仍然是整篇 BlockNote JSON 覆盖写入；如果 A、B 两个页面同时编辑同一文档，后保存的一方可能覆盖先保存的一方。
- 当前前端收到 `document.content_updated` 后会拉取最新正文并同步到 BlockNote，但没有区分远端更新来自其他页面还是当前页面，也没有提示“文档已被其他页面修改”。
- 当前没有在线状态、编辑锁、版本冲突提示、字段级 diff、OT/CRDT 合并或 Yjs 协同能力。
- 后续需要单独设计协同编辑策略，候选方向包括：
  - 最小方案：基于 `version/content_hash` 做乐观锁，保存冲突时提示用户刷新或手动合并。
  - 中间方案：页面级 presence + 正在编辑提示，降低无感覆盖概率。
  - 完整方案：引入 Yjs/CRDT 做真正多人协同编辑，但复杂度较高，应独立成后续里程碑。

## M7.1 范围

- 部署配置梳理：
  - 校验 `.env.example` 是否覆盖 API、Web、PostgreSQL、Redis、RabbitMQ、Qdrant 和 LLM 配置。
  - 明确 API / Worker / Web 的本地和生产启动命令。
  - 补充部署平台健康检查说明。
- Docker Compose 收尾：
  - 检查依赖启动顺序和 healthcheck。
  - 保证本地环境可一键启动核心服务。

## M7.1 当前状态

- 已新增 `.dockerignore`，避免把本地依赖、构建产物和 `.env` 打进镜像。
- 已新增 `deployments/docker/api.Dockerfile`，同一镜像产出 `api`、`worker`、`migrate` 三个 Go 二进制。
- 已新增 `deployments/docker/web.Dockerfile` 和 `deployments/docker/web.nginx.conf`，用于构建并托管 Web 静态产物，支持 SPA fallback 和 `/health`。
- 已扩展 `docker-compose.yml`：
  - 基础设施保留 PostgreSQL、RabbitMQ、Qdrant。
  - PostgreSQL、RabbitMQ、Qdrant、API 增加 healthcheck。
  - 新增 `app` profile，支持 `migrate`、`api`、`worker`、`web` 容器化演示链路。
- 已更新 `.env.example`，补充 smoke 变量和 AI/基础设施分组说明。
- 已新增 `docs/deployment-readiness.md`，覆盖环境变量、Docker Compose 演示、生产部署拆分、健康检查和验证命令。
- 已更新 `README.md`，补充本地快速开始、Docker Compose 可复现演示和关键验证命令。

## M7.2 范围

- 测试补强：
  - 扩展 document smoke，覆盖 realtime 订阅的基础可用性。
  - 保持 Auth、Document、AI Chat、RAG smoke 脚本可独立运行。
  - 针对关键 repository/service 增加低噪声 Go 单测。

## M7.3 移动端前置收口

- 在进入 M8 原生移动端前，先确保 Web + API 能作为稳定后端基线：
  - OpenAPI / API client 的请求和响应类型需要尽量稳定。
  - Auth token 刷新、401 处理、CORS 和公网 API 地址配置需要明确。
  - Realtime 事件协议保持轻量，移动端可先消费同一事件语义，也可按运行时能力降级。
  - 文档正文仍以 JSONB block 数据为唯一事实来源，移动端编辑器不得引入第二套不可兼容格式。
  - 排序、收藏、发布、回收站等用户状态必须继续后端持久化，不能只保存在移动端本地缓存。

M8 将作为独立阶段新增 `apps/mobile`，采用 React Native / Expo 实现原生移动端，不复用旧 My-Notion Expo 工程。

## 剩余待办

- 多实例实时广播：用 Redis Pub/Sub 把单进程 Hub 扩展到多 API 实例。
- 事件去重与节流：自动保存高频更新时，按文档 ID 合并 content updated 事件。
- 前端重连策略：增加指数退避和会话过期提示。
- 事件 smoke：用 Node fetch 流式读取验证 SSE 连接和事件 payload。
- 部署文档：补充生产环境变量、构建命令和健康检查路径。
- 移动端前置：为 M8 梳理 API client 复用、安全 token 存储、移动端 SSE/streaming 降级策略和 editor 方案。
