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

## M7.1 范围

- 部署配置梳理：
  - 校验 `.env.example` 是否覆盖 API、Web、PostgreSQL、Redis、RabbitMQ、Qdrant 和 LLM 配置。
  - 明确 API / Worker / Web 的本地和生产启动命令。
  - 补充部署平台健康检查说明。
- Docker Compose 收尾：
  - 检查依赖启动顺序和 healthcheck。
  - 保证本地环境可一键启动核心服务。

## M7.2 范围

- 测试补强：
  - 扩展 document smoke，覆盖 realtime 订阅的基础可用性。
  - 保持 Auth、Document、AI Chat、RAG smoke 脚本可独立运行。
  - 针对关键 repository/service 增加低噪声 Go 单测。

## 剩余待办

- 多实例实时广播：用 Redis Pub/Sub 把单进程 Hub 扩展到多 API 实例。
- 事件去重与节流：自动保存高频更新时，按文档 ID 合并 content updated 事件。
- 前端重连策略：增加指数退避和会话过期提示。
- 事件 smoke：用 Node fetch 流式读取验证 SSE 连接和事件 payload。
- 部署文档：补充生产环境变量、构建命令和健康检查路径。
