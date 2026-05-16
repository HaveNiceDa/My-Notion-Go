# M0 Project Foundation

## 阶段目标

把 `my-notion-go` 从技术方案推进为可独立运行、可独立展示、可持续迭代的 React + Go monorepo 工程。

## 已完成

- 初始化独立 monorepo：`pnpm-workspace.yaml`、`go.work`、`Makefile`、`docker-compose.yml`、`.env.example`。
- 初始化 Web 工程：`apps/web` 使用 React + Vite + TypeScript，开发端口为 `5273`。
- 初始化 Go API 工程：`services/api` 使用 Gin + GORM + PostgreSQL driver。
- 建立后端命令入口：`cmd/api`、`cmd/worker`、`cmd/migrate`。
- 建立后端模块目录：`config`、`database`、`auth`、`documents`、`chat`、`ai`、`rag`、`jobs` 等。
- 初始化共享包：`packages/api-client` 和 `packages/shared`。
- 初始化基础设施占位：PostgreSQL、RabbitMQ、Qdrant、部署目录、OpenAPI 起点。
- 确认 `my-notion-go` 作为独立 Git 仓库存在，并被主仓库登记为 submodule。

## 关键产物

- `apps/web`
- `services/api`
- `packages/api-client`
- `packages/shared`
- `docker-compose.yml`
- `docs/architecture-plan.md`

## 验证结论

- `go mod tidy` 通过。
- `go test ./...` 通过。
- `pnpm install` 通过。
- `pnpm typecheck` 通过。
- `pnpm build:api` 通过。
- `pnpm build:web` 通过。

## 当前边界

- 本阶段只有工程骨架和健康检查，没有真实业务模块。
- API 基础路径包括 `GET /health` 和 `GET /api/v1/ping`。

## 来源日志

- `progress/20260510-154509.md`
