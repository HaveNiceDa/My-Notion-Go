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
  - 文档详情或导航区域增加知识库开关入口。
  - 索引状态由后端维护；前端顶部只展示轻量开关，不展示详细索引进度。
  - AI 面板支持普通 Chat 与 RAG Chat 的模式切换或上下文开关。
  - RAG 回复中展示基础引用信息。
- 验证：
  - 新增 `services/api/docs/rag.http`。
  - 新增 `scripts/smoke-rag-api.mjs`。
  - 根 `package.json` 暴露 `pnpm smoke:api:rag`。

### 第一阶段暂不做

- 不做复杂权限协作，只沿用当前用户自己的文档边界。
- 不做增量索引 diff，先支持整篇重建。
- 不做高级 rerank，先用 Qdrant topK + 最低相似度阈值过滤。
- 不做复杂引用 UI，先展示文档标题、单行 chunk 摘要、相似度和可点击来源。
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
- M5.2 先采用同步索引：`POST /api/v1/rag/documents/:id/index` 直接完成切块、embedding、Qdrant upsert 并返回 `indexed`。
- `DELETE /api/v1/rag/documents/:id/index` 同步删除当前文档的 `rag_chunks` 和 Qdrant points。

### M5.3 RAG Chat SSE

- 新增 `/api/v1/rag/chat/stream`。
- 根据用户问题生成 query embedding。
- 从 Qdrant 检索 topK chunks。
- 拼接 system/context prompt。
- 复用现有 AI streaming client 输出 SSE。
- 在 assistant metadata 中记录引用来源。

### M5.4 前端集成与体验收口

- 文档页面增加知识库开关入口。
- AI 面板增加知识库模式开关。
- RAG 回复展示引用摘要、来源文档标题和相似度分数。
- 引用来源点击使用新标签页打开，避免打断当前编辑页面。
- 文档顶部知识库入口保持轻量：只展示“知识库”开关，不在顶部展示索引进度。
- 编辑器离开页面时需要尽量 flush 最后一次正文保存请求，减少未落库内容。
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
| `qdrant.go` | Qdrant collection、upsert、search、delete |

`services/api/internal/ai/embedding.go` 负责 DashScope 原生多模态 embedding client，RAG 模块只编排调用。

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
- M5.2 文档切块与真实索引已落地：
  - `internal/rag/chunker.go` 已实现 BlockNote JSONB 到纯文本的最小转换。
  - chunker 采用固定字符窗口和少量 overlap，保留来源 block ids。
  - `POST /api/v1/rag/documents/:id/index` 已同步执行内容读取、切块、DashScope embedding、`rag_chunks` 写入和 Qdrant upsert。
  - `DELETE /api/v1/rag/documents/:id/index` 已同步删除 `rag_chunks` 和 Qdrant points，并把状态置为 `disabled`。
  - `rag_documents` 成功索引后更新为 `indexed`，并记录 `content_hash`、`chunk_count`、`indexed_at`。
  - `pnpm smoke:api:rag` 已升级为真实索引 smoke，覆盖写内容、索引、关闭清理、重新开启重建。
- M5.3 RAG Chat SSE 已落地：
  - `internal/rag/qdrant.go` 已新增带 `userId` filter 的 Qdrant search，检索边界限定在当前用户的 chunks。
  - `internal/rag/service.go` 已实现 query embedding、topK search、RAG context prompt 拼接和 citations metadata 合并。
  - `POST /api/v1/rag/chat/stream` 已注册，SSE 协议复用 AI Chat 的 `conversation`、`user_message`、`message`、`assistant_message`、`done`，并额外发送 `citations`。
  - `scripts/smoke-rag-api.mjs` 已覆盖索引后发起 RAG SSE、校验 citations、assistant metadata 和消息落库。
  - `services/api/docs/rag.http` 已补充 RAG Chat Stream 手动调试请求。
- M5.4 前端集成与体验收口已完成：
  - AI 面板已增加普通对话 / 知识库模式开关；知识库按钮默认关闭，点击后通过 toast 提示开启/关闭。
  - RAG 模式已调用 `/api/v1/rag/chat/stream`，普通模式仍调用 `/api/v1/ai/chat/stream`。
  - 前端 SSE parser 已兼容 `citations` 事件，RAG 回复下方已最小化展示引用摘要。
  - RAG Chat 已在无可用索引时降级为普通 AI 回答，不再返回 404；metadata 会标记 `rag.fallback=true`。
  - Qdrant 命中结果会再通过 PostgreSQL 校验 `user_id`、文档知识库开关和索引状态，避免 stale point 或跨用户数据进入上下文。
  - RAG 检索已增加 `minScore=0.6` 阈值过滤，低于阈值的命中不会进入 context 或 citations。
  - 文档顶部栏已增加知识库开关，开启/关闭后通过 toast 提示结果。
  - 文档正文保存成功后会后台触发当前文档自动重建索引。
  - RAG citations 已补充来源文档标题、相似度分数和单行 chunk preview，并在 AI 面板中支持新标签页打开来源文档。
  - 文档顶部栏知识库开关已精简为单一 `知识库` pill，不再展示索引状态或 chunk 数。
  - 已新增右下角悬浮 AI 助手入口，点击可唤起 AI 侧边栏。
  - 正文 autosave 在组件卸载时会取消 debounce，并通过 `keepalive` 尽量发出最后一次保存请求。
  - 知识库开启/关闭请求也已增加 `keepalive`，用户点击后立即退出时仍尽量送达后端。
  - 已清理前端过期的 RAG status query、轮询、cache key 和 `knowledgeBaseStatus` 文案。
- 已运行验证：
  - `node --check ./scripts/smoke-rag-api.mjs`
  - `pnpm build:api`
  - `go test ./services/api/...`
  - `pnpm smoke:api:rag`
  - `pnpm smoke:api:documents`
  - `pnpm smoke:api:ai-chat`
  - `pnpm smoke:api:embedding`
  - `pnpm typecheck`
  - `pnpm build:web`
  - 定制验证：无索引 fallback、保存正文自动索引、关闭知识库后 fallback 均通过。
  - `pnpm --filter @my-notion-go/web typecheck`
  - `go test ./services/api/...`
  - `pnpm build:api`
  - `pnpm build:web`
- M5.5 RAG 异步索引 worker 已落地：
  - 新增 `internal/jobs` DB-backed 任务队列，复用既有 `jobs` 表记录 `rag.index` 任务。
  - RAG 开启知识库和正文保存后的重建不再直接执行 embedding/Qdrant，而是创建 pending job。
  - 新增 `internal/rag.IndexWorker`，通过 `FOR UPDATE SKIP LOCKED` 领取 pending job，执行切块、embedding、Qdrant upsert 并更新 `rag_documents`。
  - `cmd/worker` 已从占位入口升级为真实 worker 进程，`pnpm dev` 会同时启动 web/api/worker。
  - `pnpm smoke:api:rag` 已兼容 pending/indexing 状态，并轮询等待最终 indexed。
  - 已运行 `go test ./services/api/...`、`pnpm build:api`、`pnpm build:worker`、`node --check ./scripts/smoke-rag-api.mjs`。
- Agent 方向规划已确认：
  - RAG 后续不再作为长期独立问答章节，而是收敛为 Agent 的 `knowledge_base.search` tool。
  - 后续联网搜索、文档操作、任务创建等能力也应通过 tool registry 接入 Agent。
  - 当前不再推进人工 query intent 前置规则，避免把是否调用 RAG 写死在启发式判断里。
  - 当前 `/api/v1/rag/chat/stream` 保留为过渡入口和 smoke 验证入口，未来可由统一 Agent 编排复用底层检索能力。
- M5.7 引用来源定位与高亮已落地：
  - 后端 citation DTO 新增 `blockIds`，从 `rag_chunks.block_ids` 解析来源 BlockNote block。
  - AI 面板 citation 链接会携带 `citationChunkId`、`citationBlockId` 和 `citationPosition`。
  - 文档页读取 citation query 参数后传入编辑器，BlockNote 挂载后滚动到来源 block 并做短暂高亮。
  - `pnpm smoke:api:rag` 已补充 `blockIds` 断言，确保 RAG tool result 保留可定位元数据。
  - 已运行 `go test ./services/api/...`、`pnpm --filter @my-notion-go/web typecheck`、`node --check ./scripts/smoke-rag-api.mjs`。
- M5 收口验证已完成：
  - `go test ./services/api/...` 通过。
  - `pnpm --filter @my-notion-go/web build` 通过。
  - `API_BASE_URL=http://localhost:18080 pnpm smoke:api:rag` 通过。
  - 本次 smoke 使用临时启动的最新 API 进程，避免被本地 `:8080` 上旧 API 进程影响。
- M5 已收口完成；下一阶段建议进入 M6 搜索/回收站/收藏/发布页面，或按 Agent + Tool 规划启动 Agent 模块设计。

## 来源日志

- `progress/20260516-173500.md`
- `progress/20260516-180800.md`
- `progress/20260516-183115.md`
- `progress/20260516-183957.md`
- `progress/20260516-190135.md`
- `progress/20260516-222300.md`
- `progress/20260516-230500.md`
- `progress/20260516-222454.md`
- `progress/20260517-151000.md`
- `progress/20260517-154500.md`
- `progress/20260517-161500.md`
- `progress/20260517-164000.md`
