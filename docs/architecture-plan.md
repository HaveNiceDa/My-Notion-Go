# My-Notion Go Edition 技术方案

## 1. 项目定位

`my-notion-go` 是一个完全独立于现有 My-Notion 主工程的新项目，用于从零实现一个 React + Go 技术栈的 Notion 类知识管理系统。

本项目不以兼容现有 Convex / Expo / Next.js 链路为目标，而是作为一个独立工程重新设计 Web 端、Go 后端、数据库、实时通信、异步任务、AI 与 RAG 能力。

核心目标：

1. 系统学习并实践 Go 后端工程能力。
2. 使用 React 重新实现 My-Notion Web 端核心功能。
3. 通过 monorepo 组织前端、后端、共享 SDK、部署与文档。
4. 覆盖一个相对完整的全栈项目链路：鉴权、CRUD、富文本、AI、RAG、消息队列、实时通信、部署。

非目标：

1. 不追求与当前 My-Notion 主工程无缝迁移。
2. 不复用 Convex 作为后端数据源。
3. 第一阶段不实现多人协同编辑。
4. 第一阶段不追求移动端复刻，只聚焦 Web 端完整实现。

## 2. 总体架构

```mermaid
flowchart TD
    Web[React Web App] --> API[Go API - Gin]
    API --> Auth[Auth Module]
    API --> Doc[Document Module]
    API --> Editor[Content Module]
    API --> Chat[AI Chat Module]
    API --> Search[Search / RAG Module]
    API --> Realtime[Realtime Module]

    Auth --> PG[(PostgreSQL)]
    Doc --> PG
    Editor --> PG
    Chat --> PG
    Search --> PG
    Search --> QD[(Qdrant Optional)]

    API --> MQ[RabbitMQ Optional]
    MQ --> Worker[Go Worker]
    Worker --> QD
    Worker --> LLM[LLM API]

    Realtime --> SSE[SSE]
    Realtime --> WS[WebSocket Optional]

    classDef frontend fill:#e3f2fd,color:#0d47a1
    classDef backend fill:#e8f5e9,color:#1b5e20
    classDef infra fill:#fff3e0,color:#e65100
    class Web frontend
    class API,Auth,Doc,Editor,Chat,Search,Realtime,Worker backend
    class PG,QD,MQ,LLM,SSE,WS infra
```

架构原则：

1. 第一版采用 modular monolith，而不是微服务。
2. 后端只有 `api` 和 `worker` 两个进程，避免过早拆分。
3. 数据库选 PostgreSQL，文档正文用 JSONB。
4. AI 流式输出优先使用 SSE。
5. RabbitMQ、Qdrant、WebSocket 作为第二阶段能力逐步引入。
6. 前端通过 OpenAPI 生成的 TypeScript client 访问后端。

## 3. 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| Monorepo | pnpm workspace + go work + Makefile | 统一管理 React、Go、共享包和脚本 |
| Web | React + Vite + TypeScript | 专注 SPA 和 API 调用，不依赖 Next.js |
| 路由 | TanStack Router 或 React Router | 文档页、登录页、AI 页、设置页 |
| 数据请求 | TanStack Query | 前端服务端状态管理 |
| UI | Tailwind CSS + shadcn/ui | 快速搭建类 Notion UI |
| 编辑器 | BlockNote 或 Tiptap | 富文本编辑和 block JSON 存储 |
| 状态管理 | Zustand | 主题、侧边栏、AI 配置、本地 UI 状态 |
| API 框架 | Gin | REST API、Middleware、SSE |
| ORM | GORM | PostgreSQL CRUD、事务、关联 |
| 数据库 | PostgreSQL | 用户、文档、消息、任务状态、JSONB 内容 |
| 迁移 | golang-migrate 或 goose | 数据库版本管理 |
| 鉴权 | 自研 JWT + Refresh Token | 完整学习登录态设计 |
| 实时 | SSE，后续 WebSocket | AI 流、任务状态、文档事件 |
| 队列 | RabbitMQ | 文档索引、AI 摘要、异步任务 |
| AI | OpenAI Compatible API | 普通对话、标题生成、RAG |
| 向量库 | Qdrant | 知识库问答和语义检索 |
| API 文档 | OpenAPI / Swagger | 生成 TS client |
| 部署 | Docker Compose + Fly.io / Render / Railway | 完整部署训练 |

## 4. 为什么选择 PostgreSQL

本项目主数据库推荐 PostgreSQL，而不是 MongoDB。

| 维度 | PostgreSQL | MongoDB | 结论 |
| --- | --- | --- | --- |
| Go ORM 适配 | GORM 一等支持 | 需要 MongoDB Driver | PostgreSQL 更适合 |
| 文档正文 | JSONB 可存 block JSON | BSON 原生文档模型 | MongoDB 略强 |
| 文档树 | 递归查询、path、ltree 成熟 | 需要业务侧维护结构 | PostgreSQL 更适合 |
| 事务一致性 | 强事务、外键、约束成熟 | 支持事务但建模更自由 | PostgreSQL 更适合 |
| AI 会话 | 关系表自然表达 | 可做但聚合更绕 | PostgreSQL 更适合 |
| 搜索能力 | 全文检索、JSONB 索引、pg_trgm | Atlas Search 强但依赖平台 | PostgreSQL 更稳 |
| 学习收益 | SQL、事务、索引、迁移、GORM | NoSQL 建模 | PostgreSQL 更贴合目标 |

结论：

1. My-Notion 的数据不是纯文档型，还包含用户、权限、文档树、AI 会话、任务、RAG 状态。
2. PostgreSQL 的关系模型更适合主业务库。
3. JSONB 足够承载富文本编辑器内容。
4. GORM 与 PostgreSQL 的组合更符合学习 Go 完整后端工程的目标。

## 5. Monorepo 目录设计

```txt
my-notion-go/
  README.md
  package.json
  pnpm-workspace.yaml
  go.work
  Makefile
  docker-compose.yml
  .env.example

  apps/
    web/
      package.json
      vite.config.ts
      index.html
      src/
        app/
        pages/
        features/
          auth/
          documents/
          editor/
          ai-chat/
          search/
          settings/
        components/
        hooks/
        lib/
        styles/

  services/
    api/
      go.mod
      cmd/
        api/
          main.go
        worker/
          main.go
        migrate/
          main.go
      internal/
        config/
        database/
        logger/
        middleware/
        auth/
        users/
        documents/
        contents/
        chat/
        ai/
        rag/
        realtime/
        jobs/
        storage/
        response/
        errors/
      migrations/
      docs/
        openapi.yaml

  packages/
    api-client/
      package.json
      src/
        generated/
        client.ts
        hooks/
    shared/
      package.json
      src/
        types/
        constants/
        validators/

  deployments/
    docker/
    fly/
    render/

  docs/
    architecture-plan.md
    database-design.md
    api-design.md
    roadmap.md
```

## 6. 后端模块分工

| 模块 | Go 包 | 职责 |
| --- | --- | --- |
| 配置 | `internal/config` | 读取 env、数据库、JWT、AI、MQ 配置 |
| 数据库 | `internal/database` | GORM 初始化、事务封装、migration |
| 日志 | `internal/logger` | 结构化日志 |
| 中间件 | `internal/middleware` | CORS、鉴权、错误恢复、请求日志 |
| 鉴权 | `internal/auth` | 注册、登录、密码 hash、JWT、refresh token |
| 用户 | `internal/users` | 用户资料、当前用户、偏好设置 |
| 文档 | `internal/documents` | 文档元信息、树结构、归档、恢复、收藏 |
| 内容 | `internal/contents` | 文档正文 JSONB、自动保存、版本号 |
| AI | `internal/ai` | LLM 调用、SSE 输出、模型配置 |
| 聊天 | `internal/chat` | 会话、消息、thinking steps |
| RAG | `internal/rag` | chunk、embedding、Qdrant 检索 |
| 实时 | `internal/realtime` | SSE/WebSocket 连接、事件推送 |
| 任务 | `internal/jobs` | RabbitMQ producer/consumer、重试、死信 |
| 存储 | `internal/storage` | 文件上传、图片元信息、对象存储适配 |
| 响应 | `internal/response` | 统一返回结构、分页、错误码 |
| 错误 | `internal/errors` | 业务错误定义和 HTTP 映射 |

## 7. 前端模块分工

| 模块 | 职责 |
| --- | --- |
| `features/auth` | 登录、注册、token 管理、路由保护 |
| `features/documents` | 文档树、文档 CRUD、回收站、收藏 |
| `features/editor` | BlockNote/Tiptap 编辑器、自动保存 |
| `features/ai-chat` | AI 对话、流式渲染、会话历史 |
| `features/search` | 文档搜索、命令菜单 |
| `features/settings` | 主题、模型、用户设置 |
| `packages/api-client` | OpenAPI 生成 client + React Query hooks |
| `packages/shared` | 跨端类型、常量、校验规则 |

## 8. 核心数据模型

| 表 | 说明 |
| --- | --- |
| `users` | 用户账号、邮箱、密码 hash |
| `refresh_tokens` | Refresh token、过期时间、设备信息 |
| `documents` | 文档元数据、树结构、归档、收藏、发布状态 |
| `document_contents` | 文档正文 JSONB、内容 hash、版本号 |
| `document_versions` | 可选，文档历史版本 |
| `ai_conversations` | AI 会话列表 |
| `ai_messages` | AI 消息，支持文本和图片 JSON |
| `ai_thinking_steps` | RAG 检索过程、工具调用过程 |
| `rag_documents` | 文档向量化状态 |
| `rag_chunks` | chunk 元数据，向量放 Qdrant |
| `jobs` | 异步任务状态 |
| `files` | 上传文件元信息 |

文档表建议：

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  parent_id UUID NULL REFERENCES documents(id),
  title TEXT NOT NULL,
  icon TEXT,
  cover_image TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_in_knowledge_base BOOLEAN NOT NULL DEFAULT FALSE,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE document_contents (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL
);
```

## 9. API 设计

| API | 方法 | 用途 |
| --- | --- | --- |
| `/api/v1/auth/register` | `POST` | 注册 |
| `/api/v1/auth/login` | `POST` | 登录 |
| `/api/v1/auth/refresh` | `POST` | 刷新 token |
| `/api/v1/auth/logout` | `POST` | 退出登录 |
| `/api/v1/me` | `GET` | 当前用户 |
| `/api/v1/documents` | `POST` | 创建文档 |
| `/api/v1/documents/tree` | `GET` | 文档树 |
| `/api/v1/documents/trash` | `GET` | 回收站 |
| `/api/v1/documents/:id` | `GET` | 文档详情 |
| `/api/v1/documents/:id` | `PATCH` | 更新标题、图标、封面 |
| `/api/v1/documents/:id/content` | `PUT` | 保存正文 |
| `/api/v1/documents/:id/archive` | `POST` | 归档 |
| `/api/v1/documents/:id/restore` | `POST` | 恢复 |
| `/api/v1/documents/:id` | `DELETE` | 永久删除 |
| `/api/v1/ai/conversations` | `GET` | 会话列表 |
| `/api/v1/ai/conversations` | `POST` | 创建会话 |
| `/api/v1/ai/conversations/:id/messages` | `GET` | 获取消息 |
| `/api/v1/ai/chat/stream` | `POST` | AI SSE 对话 |
| `/api/v1/rag/documents/:id/index` | `POST` | 加入知识库 |
| `/api/v1/rag/documents/:id/index` | `DELETE` | 移出知识库 |
| `/api/v1/rag/chat/stream` | `POST` | RAG SSE 对话 |
| `/api/v1/realtime/events` | `GET` | SSE 事件流 |

## 10. 实时方案

第一阶段只做 SSE：

1. AI 流式输出使用 SSE。
2. 异步任务状态使用 SSE。
3. 文档树变化可以通过 SSE 通知前端 invalidate query。

第二阶段再引入 WebSocket：

1. 多页面文档状态同步。
2. 聊天消息实时同步。
3. 在线状态或协作提示。

暂不做多人协同编辑。多人协同编辑通常需要 Yjs / CRDT / OT，复杂度高，容易偏离 Go 后端学习主线。

事件流：

```mermaid
sequenceDiagram
    participant Web as React Web
    participant API as Go API
    participant PG as PostgreSQL
    participant MQ as RabbitMQ
    participant Worker as Go Worker
    participant QD as Qdrant

    Web->>API: PUT /documents/:id/content
    API->>PG: Save JSONB content
    API->>MQ: Publish document.updated
    API-->>Web: 200 OK
    Worker->>MQ: Consume document.updated
    Worker->>Worker: Chunk + Embedding
    Worker->>QD: Upsert vectors
    Worker->>PG: Update rag_documents status
```

## 11. 功能范围

| 模块 | 第一版能力 | 进阶能力 |
| --- | --- | --- |
| Auth | 注册、登录、JWT、Refresh Token、退出登录 | 邮箱验证、OAuth、设备管理 |
| Documents | 创建、重命名、删除、归档、恢复、收藏 | 拖拽排序、发布分享、权限协作 |
| Editor | 富文本编辑、自动保存、JSONB 存储 | 图片、代码块、表格、版本历史 |
| Sidebar | 文档树、最近文档、搜索 | 实时刷新、批量操作 |
| AI Chat | 普通对话、SSE 流式输出、会话历史 | Thinking Steps、Tool Call、模型切换 |
| RAG | 文档加入知识库、向量化、基于文档问答 | 异步索引、增量更新、重建索引 |
| Realtime | AI SSE、任务状态 SSE | WebSocket 文档状态同步 |
| Files | 本地/对象存储上传图片 | S3/R2、图片压缩、权限控制 |
| Admin | 健康检查、任务列表 | 监控、审计日志 |

## 12. 学习路径

| 阶段 | 学习重点 | 目标 |
| --- | --- | --- |
| Phase 0 | Monorepo、Docker、Go 工程结构 | 项目能一键启动 |
| Phase 1 | Gin、GORM、PostgreSQL | 完成 Auth + Document CRUD |
| Phase 2 | React Query、OpenAPI、前后端联调 | 前端完整使用 Go API |
| Phase 3 | 富文本编辑器、JSONB、自动保存 | 完成 Notion 核心编辑体验 |
| Phase 4 | SSE、AI 流式输出 | 完成 AI Chat |
| Phase 5 | RabbitMQ、Worker、Qdrant | 完成 RAG 知识库 |
| Phase 6 | WebSocket/SSE 事件系统 | 替代基础实时能力 |
| Phase 7 | 部署、日志、监控、测试 | 形成完整工程闭环 |

## 13. 开发里程碑

| 里程碑 | 产出 | 预估时间 |
| --- | --- | ---: |
| M0 | monorepo + docker-compose + hello API + hello Web | 1-2 天 |
| M1 | Auth + JWT + 用户表 + 登录注册页面 | 3-5 天 |
| M2 | Document CRUD + 文档树 + React Query hooks | 5-7 天 |
| M3 | Editor + JSONB 保存 + 自动保存 | 5-7 天 |
| M4 | AI Chat + SSE + 会话历史 | 5-7 天 |
| M5 | RabbitMQ Worker + RAG 索引 + Qdrant | 7-10 天 |
| M6 | 搜索、回收站、收藏、发布页面 | 5-7 天 |
| M7 | WebSocket/SSE 事件、部署、测试 | 7-10 天 |

整体预估：

1. 可运行 MVP：2-3 周。
2. 覆盖主要 My-Notion Web 功能：5-8 周。
3. 加上 AI/RAG/RabbitMQ/WebSocket/部署：8-12 周。

## 14. 推荐最小闭环

第一版应优先完成：

1. React Web 登录注册。
2. Go JWT 鉴权。
3. PostgreSQL 文档树。
4. 富文本 JSONB 保存。
5. AI SSE 对话。
6. Docker Compose 一键启动。

完成这 6 个能力后，项目已经具备完整全栈作品的基本形态。

第二版再引入：

1. RabbitMQ 异步任务。
2. Qdrant RAG。
3. WebSocket 实时通知。
4. OpenAPI 生成 TS client。
5. CI/CD 与部署。
6. 单元测试与集成测试。

## 15. 与现有项目的关系

现有 My-Notion 主工程继续作为当前产品实现。

`my-notion-go` 作为新的学习型全栈项目：

1. 不复用 Convex。
2. 不复用 Next.js 服务端 API。
3. 不复用 Expo 移动端。
4. 可以参考原项目的产品交互和数据概念。
5. 可以在成熟后反向沉淀经验到主工程。

这种方式的优势：

1. 没有旧链路兼容成本。
2. 可以从零设计真正的 Go 后端。
3. 项目边界清晰，适合作品集展示。
4. 现有主项目不受实验性重构影响。
5. 学习路径完整，覆盖前端、后端、数据库、队列、实时、AI、部署。

