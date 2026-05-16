# M5 RAG + Worker + Qdrant

## 阶段目标

正式进入 RAG 阶段，在 M4 AI Chat SSE 闭环之上，引入知识库索引、文档切块、向量检索和基于文档的问答能力。

M5 的目标不是一次性铺满所有基础设施，而是先完成一个可验证的最小闭环：

1. 用户把文档加入知识库。
2. 后端读取文档正文 JSONB 并切块。
3. Worker 或同步任务生成 embedding 并写入 Qdrant。
4. RAG Chat 根据用户问题检索相关 chunk。
5. 后端把检索上下文拼入 OpenAI Compatible 请求。
6. 前端通过 SSE 看到带文档上下文的回答。

## 范围边界

### 第一阶段必须完成

- 数据模型：
  - `rag_documents`：记录文档索引状态。
  - `rag_chunks`：记录 chunk 元数据、所属文档、位置、内容摘要和 Qdrant point id。
  - `jobs`：记录索引任务状态，便于前端展示 pending/running/completed/failed。
- 后端 RAG 模块：
  - `services/api/internal/rag`
  - 文档加入知识库。
  - 文档移出知识库。
  - 文档切块。
  - embedding client。
  - Qdrant upsert/search/delete adapter。
- API：
  - `POST /api/v1/rag/documents/:id/index`
  - `DELETE /api/v1/rag/documents/:id/index`
  - `GET /api/v1/rag/documents/:id/status`
  - `POST /api/v1/rag/chat/stream`
- 前端：
  - 文档详情或导航区域增加“加入知识库”入口。
  - 展示索引状态。
  - AI 面板支持普通 Chat 与 RAG Chat 的模式切换或上下文开关。
  - RAG 回复中展示基础引用信息。
- 验证：
  - 新增 `services/api/docs/rag.http`。
  - 新增 `scripts/smoke-rag-api.mjs`。
  - 根 `package.json` 暴露 `pnpm smoke:api:rag`。

### 第一阶段暂不做

- 不做复杂权限协作，只沿用当前用户自己的文档边界。
- 不做增量索引 diff，先支持整篇重建。
- 不做高级 rerank，先用 Qdrant topK 结果。
- 不做复杂引用 UI，先展示文档标题、chunk 摘要或序号。
- 不强制一开始接入 RabbitMQ；如果同步索引足够支撑 smoke，可以先用 Go worker abstraction 保留后续替换点。
- 不把 Redis 作为核心持久化来源，任务最终状态仍以 PostgreSQL 为准。

## 推荐实现顺序

### M5.0 设计与环境

- 补 `docker-compose.yml` 的 Qdrant 服务。
- 确认是否立即引入 Redis/RabbitMQ；若引入，先只作为任务状态缓存和异步队列，不承载核心业务数据。
- 扩展 `.env.example`：
  - `QDRANT_URL`
  - `QDRANT_API_KEY`
  - `DASHSCOPE_API_KEY`
  - `DASHSCOPE_API_BASE_URL`
- embedding 模型名和维度固定在 `internal/ai` 代码常量中，避免运行时误改导致 Qdrant collection 维度不一致。
- AI Chat 继续使用 OpenAI Compatible `LLM_BASE_URL`；embedding 使用 DashScope 原生多模态 API，避免协议混用。

### M5.1 数据模型与 API 骨架

- 新增 migration：
  - `rag_documents`
  - `rag_chunks`
  - `jobs`
- 新增 `internal/rag` 的 `models.go`、`repository.go`、`service.go`、`handler.go`。
- 注册受保护 RAG 路由。
- 完成加入/移出知识库和状态查询。
- 先让 API 能稳定返回状态，即使索引逻辑仍是 stub。
- 产品规则：文档默认开启知识库；用户可通过关闭操作显式移出知识库。

### M5.2 文档切块与索引

- 从 `document_contents.content` 读取 BlockNote JSONB。
- 实现 BlockNote block 到纯文本的最小转换。
- 按段落或固定 token/字符窗口切块。
- 保存 `rag_chunks` 元数据。
- 调用 embedding client 生成向量。
- 调用 Qdrant upsert 写入 point。

### M5.3 RAG Chat SSE

- 新增 `/api/v1/rag/chat/stream`。
- 根据用户问题生成 query embedding。
- 从 Qdrant 检索 topK chunks。
- 拼接 system/context prompt。
- 复用现有 AI streaming client 输出 SSE。
- 在 assistant metadata 中记录引用来源。

### M5.4 前端集成

- 文档页面增加知识库状态入口。
- AI 面板增加 RAG 模式开关。
- RAG 回复展示引用摘要。
- 保持所有用户可见文案进入 `resources.ts` 的 `zh/en`。
- 交互控件继续使用 shadcn/ui 本地组件，避免 raw interactive controls。

## 后端模块设计

建议新增模块：

```txt
services/api/internal/rag/
  models.go
  repository.go
  service.go
  handler.go
  chunker.go
  embedding.go
  qdrant.go
```

职责划分：

| 文件 | 职责 |
| --- | --- |
| `models.go` | RAG 数据模型和 DTO |
| `repository.go` | PostgreSQL 读写，包含索引状态和 chunk 元数据 |
| `service.go` | 业务编排，校验文档归属、索引、检索、RAG prompt |
| `handler.go` | HTTP 入参、鉴权上下文、SSE 输出 |
| `chunker.go` | BlockNote JSONB 到纯文本和 chunk |
| `embedding.go` | DashScope 原生多模态 embedding client |
| `qdrant.go` | Qdrant collection、upsert、search、delete |

## 数据表草案

### `rag_documents`

| 字段 | 说明 |
| --- | --- |
| `id` | UUID 主键 |
| `user_id` | 用户 ID |
| `document_id` | 文档 ID |
| `status` | `pending` / `indexing` / `indexed` / `failed` |
| `content_hash` | 文档内容 hash，用于判断是否需要重建 |
| `chunk_count` | 当前 chunk 数 |
| `last_error` | 最近一次失败原因 |
| `indexed_at` | 最近一次成功索引时间 |
| `created_at` / `updated_at` | 时间戳 |

### `rag_chunks`

| 字段 | 说明 |
| --- | --- |
| `id` | UUID 主键 |
| `user_id` | 用户 ID |
| `document_id` | 文档 ID |
| `rag_document_id` | RAG 文档 ID |
| `qdrant_point_id` | Qdrant point id |
| `content` | chunk 文本 |
| `block_ids` | 来源 BlockNote block ids |
| `position` | chunk 顺序 |
| `token_count` | 估算 token 数 |
| `metadata` | JSONB 扩展字段 |
| `created_at` / `updated_at` | 时间戳 |

### `jobs`

| 字段 | 说明 |
| --- | --- |
| `id` | UUID 主键 |
| `user_id` | 用户 ID |
| `type` | 任务类型，例如 `rag.index` |
| `status` | `pending` / `running` / `completed` / `failed` |
| `payload` | JSONB 任务输入 |
| `result` | JSONB 任务结果 |
| `last_error` | 失败原因 |
| `created_at` / `updated_at` / `finished_at` | 时间戳 |

## API 草案

| API | 方法 | 用途 |
| --- | --- | --- |
| `/api/v1/rag/documents/:id/index` | `POST` | 将文档加入知识库并触发索引 |
| `/api/v1/rag/documents/:id/index` | `DELETE` | 将文档移出知识库并删除向量 |
| `/api/v1/rag/documents/:id/status` | `GET` | 查询索引状态 |
| `/api/v1/rag/chat/stream` | `POST` | 基于知识库上下文进行 SSE 问答 |

RAG Chat 请求体草案：

```json
{
  "conversationId": "optional-uuid",
  "message": "总结这篇文档的关键结论",
  "documentId": "optional-document-uuid",
  "model": "deepseek-v4-pro",
  "topK": 5
}
```

## 验证标准

- `pnpm build:api` 通过。
- `go test ./services/api/...` 通过。
- `pnpm --filter @my-notion-go/web typecheck` 通过。
- `pnpm --filter @my-notion-go/web build` 通过。
- `pnpm smoke:api:embedding` 覆盖：
  - 读取本地 `.env` 的 DashScope/Qdrant 配置，但不打印密钥。
  - 调用 DashScope 原生多模态 embedding API。
  - 校验 embedding 维度为 `1024`。
  - 探活 Qdrant `/healthz`。
  - 创建临时 Qdrant collection。
  - upsert 生成的向量。
  - search 返回刚写入的 point。
  - 删除临时 collection，避免污染正式 RAG collection。
- `pnpm smoke:api:rag` 覆盖：
  - 登录。
  - 创建文档。
  - 写入文档正文。
  - 加入知识库。
  - 等待索引完成。
  - 发起 RAG SSE 问答。
  - 确认 assistant 回复落库。
  - 确认 metadata 包含引用来源。

## 风险与注意

- embedding 维度必须和 Qdrant collection 配置一致，否则 upsert/search 会失败。
- 文档 JSONB 到纯文本的转换要先做最小可用，不要一开始追求完整 BlockNote 语义。
- Qdrant point id 要稳定，方便重建索引时覆盖或删除。
- RAG prompt 必须清楚区分用户问题和检索上下文，避免 prompt 注入污染系统指令。
- 上游 embedding 和 chat quota 错误应透传为明确错误，方便前端提示和 smoke 定位。
- RabbitMQ/Redis 可以分阶段引入；不要让基础设施复杂度阻塞 RAG 最小闭环。

## 当前状态

- M5 已正式开启。
- M5.0 配置和初始化代码已落地：
  - `.env.example` 已补充 Qdrant collection、Qdrant API key、DashScope API key 和 DashScope native API base URL。
  - `config.Load` 已读取 Qdrant 和 DashScope native API 配置。
  - embedding 模型固定为 `tongyi-embedding-vision-plus-2026-03-06`，维度固定为 `1024`。
  - `internal/ai` 已新增 DashScope 原生多模态 embedding client。
  - `internal/rag` 已新增 Qdrant client，并支持 health check 与 collection 初始化。
  - `main.go` 已接入 embedding 配置检查和非阻塞 Qdrant 初始化。
  - `scripts/smoke-embedding-qdrant.mjs` 已新增 embedding/Qdrant 专项 smoke。
- `pnpm smoke:api:embedding` 已切换到 DashScope 原生多模态 embedding API，用于验证向量生成和 Qdrant 写搜删链路。
- 已运行 `pnpm smoke:api:embedding`：
  - Qdrant `/healthz` 通过。
  - `tongyi-embedding-vision-plus-2026-03-06` 成功生成 `1024` 维向量。
  - 临时 Qdrant collection 创建、upsert、search、cleanup 全部通过。
- 已运行 `pnpm smoke:api:ai-chat`，确认 AI Chat 的 OpenAI Compatible SSE 链路仍正常。
- M5.1 数据模型与 API 骨架已落地：
  - `000004_rag_schema` 已新增 `rag_documents`、`rag_chunks`、`jobs`。
  - `documents.is_in_knowledge_base` 默认值已改为 `true`，历史未删除文档已迁移为默认进入知识库。
  - `internal/rag` 已新增 `models.go`、`repository.go`、`service.go`、`handler.go`。
  - 已注册 `POST /api/v1/rag/documents/:id/index`、`DELETE /api/v1/rag/documents/:id/index`、`GET /api/v1/rag/documents/:id/status`。
  - `services/api/docs/rag.http` 和 `pnpm smoke:api:rag` 已新增。
  - `pnpm smoke:api:rag` 已验证默认开启、关闭、状态查询、重新开启和清理流程。
- 尚未实现 BlockNote 切块、真实索引 job、Qdrant 正式 upsert/search 和前端入口。
- 下一步建议进入 M5.2：实现文档内容读取、最小纯文本转换、chunker、embedding 和 Qdrant upsert。
