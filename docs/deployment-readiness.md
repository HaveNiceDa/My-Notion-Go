# Deployment Readiness

## 目标

本文档用于把 `my-notion-go` 整理成可部署、可展示、可复现的状态。当前推荐先使用 Docker Compose 做本地完整演示，再按目标平台拆分 Web、API、Worker 和基础设施；后续新增原生移动端时，移动端以独立 App 构建和分发，不进入 Docker Compose 演示链路。

## 组件

| 组件 | 说明 | 默认端口 |
| --- | --- | --- |
| Web | React + Vite 静态站点，Nginx 托管 | `8081` |
| Mobile | React Native / Expo 原生移动端，连接公网 API | 无固定端口 |
| API | Go + Gin REST/SSE 服务 | `8080` |
| Worker | Go RAG 索引 worker | 无 HTTP 端口 |
| PostgreSQL | 主业务数据库 | `5432` |
| Qdrant | RAG 向量库 | `6333` |
| RabbitMQ | 预留消息队列 | `5672`, `15672` |

## 环境变量

复制示例文件：

```bash
cp .env.example .env
```

核心变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | API、Worker、Migration 使用的 PostgreSQL 连接串 |
| `JWT_ACCESS_SECRET` | 是 | Access token 签名密钥，生产必须替换 |
| `JWT_REFRESH_SECRET` | 是 | Refresh token 签名密钥，生产必须替换 |
| `CORS_ALLOWED_ORIGINS` | 是 | Web 访问 API 的 origin 白名单，多个值用逗号分隔 |
| `VITE_API_BASE_URL` | 是 | Web 构建时写入的 API 地址 |
| `EXPO_PUBLIC_API_BASE_URL` | 移动端阶段必填 | Mobile 构建时写入的 API 地址，只能放公开 API 地址 |
| `QDRANT_URL` | 否 | Qdrant 地址；缺失时 RAG 能力不可用 |
| `QDRANT_COLLECTION` | 否 | Qdrant collection 名称 |
| `LLM_API_KEY` / `DASHSCOPE_API_KEY` | 否 | AI Chat、Embedding、RAG 需要 |

安全要求：

- 生产环境禁止使用 `.env.example` 中的默认 JWT secret。
- `DATABASE_URL`、JWT secret、LLM API key 不应提交到 Git。
- `VITE_API_BASE_URL` 和 `EXPO_PUBLIC_API_BASE_URL` 会进入客户端产物，只能放公开 API 地址，不能放密钥。

## 本地开发

启动基础设施：

```bash
docker compose up -d postgres qdrant rabbitmq
```

安装依赖并迁移数据库：

```bash
pnpm install
pnpm migrate:api
```

启动 Web、API、Worker：

```bash
pnpm dev
```

访问地址：

- Web: `http://localhost:5273`
- API health: `http://localhost:8080/health`
- RabbitMQ management: `http://localhost:15672`
- Qdrant: `http://localhost:6333/dashboard`

## Docker Compose 演示

Compose 提供 `app` profile，用于构建并启动 Web、API、Worker 和 migration。

先启动数据库与向量库：

```bash
docker compose up -d postgres qdrant rabbitmq
```

执行迁移：

```bash
docker compose --profile app run --rm migrate
```

启动完整演示环境：

```bash
docker compose --profile app up --build web api worker
```

访问地址：

- Web: `http://localhost:8081`
- API: `http://localhost:8080`
- API health: `http://localhost:8080/health`
- Web health: `http://localhost:8081/health`

## 生产部署拆分

推荐拆分为四类服务：

- Web 静态站点：使用 `deployments/docker/web.Dockerfile` 构建，部署到静态托管或容器平台。
- Mobile 原生 App：使用 Expo / EAS 或 Xcode / Gradle 构建，配置 `EXPO_PUBLIC_API_BASE_URL` 指向 API 公网地址。
- API 服务：使用 `deployments/docker/api.Dockerfile`，启动命令 `./api`。
- Worker 服务：使用同一个 API 镜像，启动命令 `./worker`。
- Migration Job：使用同一个 API 镜像，启动命令 `./migrate`，部署时先于 API/Worker 执行。

部署顺序：

1. 准备 PostgreSQL 和 Qdrant。
2. 注入生产环境变量。
3. 执行 `./migrate`。
4. 启动 API，并确认 `/health` 返回 200。
5. 启动 Worker。
6. 构建并发布 Web，确保 `VITE_API_BASE_URL` 指向 API 公网地址。
7. 构建并分发 Mobile，确保 `EXPO_PUBLIC_API_BASE_URL` 指向同一个 API 公网地址。

## 健康检查

API：

```bash
curl http://localhost:8080/health
```

预期响应：

```json
{
  "database": "ok",
  "service": "my-notion-go-api",
  "status": "ok"
}
```

Web：

```bash
curl http://localhost:8081/health
```

预期响应：

```txt
ok
```

## 验证命令

基础验证：

```bash
pnpm test:go
pnpm typecheck
pnpm build:api
pnpm build:web
```

需要 API 与数据库运行的 smoke：

```bash
pnpm smoke:api:documents
pnpm smoke:api:realtime
```

需要 AI / Qdrant 配置的 smoke：

```bash
pnpm smoke:api:ai-chat
pnpm smoke:api:rag
```

## 当前限制

- Realtime SSE 当前是单 API 进程内 Hub，多 API 实例需要接 Redis Pub/Sub。
- RabbitMQ 当前在 Compose 中作为预留基础设施，RAG 索引实际使用 `jobs` 表轮询 worker。
- 正文编辑仍是整篇 JSON 覆盖保存，未解决多人同时编辑冲突。
- Web Docker 镜像的 `VITE_API_BASE_URL` 是构建时注入，部署到不同 API 地址需要重新构建。
- Mobile 客户端同样依赖构建时 API 地址，后续如果需要多环境动态切换，应单独设计环境选择和安全边界。
