# My-Notion Go Edition

一个独立的 React + Go 全栈学习项目，用于从零实现 My-Notion Web 端核心能力。

原版 My-Notion 项目：

- GitHub: [HaveNiceDa/My-Notion](https://github.com/HaveNiceDa/My-Notion)

## 项目定位

`My-Notion Go Edition` 是对原版 My-Notion 的一次全栈重实现实验。

原版 My-Notion 使用 Next.js、Expo、Convex、Qdrant 和 Vercel Edge Function 构建，重点在于快速实现跨端 Notion 类产品和 AI 原生能力。

本项目则从工程学习和后端能力建设出发，使用 React + Go 重新实现同类功能，目标是沉淀一套更传统、更完整、也更容易展示后端能力的全栈架构。

## 技术栈

- Web: React + Vite + TypeScript
- API: Go + Gin + GORM
- Database: PostgreSQL
- Monorepo: pnpm workspace + go work

## 版本优势

相比原版 My-Notion，Go Edition 的重点不是快速堆功能，而是完整掌握和展示一个自研后端系统的工程能力。

主要优势：

- **后端自主可控**：使用 Go + Gin 构建独立 API 层，不依赖 BaaS 承接核心业务逻辑。
- **数据库建模完整**：使用 PostgreSQL + GORM 设计用户、文档、内容、AI 会话、RAG 状态等业务表。
- **工程边界清晰**：前端、后端、共享 SDK、部署配置和文档统一放在独立 monorepo 中。
- **更适合学习 Go**：覆盖路由、中间件、鉴权、ORM、事务、迁移、异步任务、实时通信和部署。
- **可扩展空间更大**：后续可自然接入 RabbitMQ、Qdrant、WebSocket、OpenAPI、Worker 和监控体系。
- **方便和原项目对比**：可以横向比较 Convex/BaaS 架构与 Go 自研服务层架构的差异。

## 未来规划

Go Edition 会逐步对齐原版 My-Notion 的核心能力，并在此基础上扩展 Go 后端工程实践。

规划方向：

- **Web 端完整复刻**：实现文档树、富文本编辑器、回收站、收藏、搜索、设置等核心能力。
- **AI 原生能力**：支持 AI Chat、流式输出、模型切换、Thinking Steps、Tool Call 和知识库问答。
- **RAG 知识库**：基于 PostgreSQL + Qdrant 实现文档向量化、语义检索和增量索引。
- **移动端对齐**：未来加入 Mobile 端，实现 Web / Mobile 共用 Go API 和统一业务模型。
- **实时能力**：先使用 SSE 支持 AI 流和任务状态，后续加入 WebSocket 支持多端状态同步。
- **异步任务系统**：引入 RabbitMQ 和 Worker，用于文档索引、AI 摘要、批量重建和失败重试。
- **工程化完善**：补充 OpenAPI、TypeScript client 生成、CI/CD、Docker 部署、测试和可观测性。

## 快速开始

```bash
pnpm install
pnpm dev
```

Go API 单独启动：

```bash
pnpm dev:api
```

Web 单独启动：

```bash
pnpm dev:web
```
