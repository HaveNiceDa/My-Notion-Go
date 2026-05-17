# My-Notion Go 里程碑索引

## 目的

`progress/` 保留按时间叙事的详细过程日志，适合追溯每次改动。

`milestones/` 用于把这些过程日志收敛成阶段性结论，适合后续喂给 AI 快速理解项目状态，减少上下文噪音。

## 阅读顺序

1. `M0-project-foundation.md`：工程骨架、monorepo、Docker、Go/Web 基础启动。
2. `M1-auth-database.md`：PostgreSQL migration、Auth 后端、Auth 前端、CORS 联调。
3. `M2-documents-workspace.md`：Document CRUD、Notion-like 工作区、文档树交互。
4. `M3-editor-blocknote.md`：Content API、BlockNote、JSONB 自动保存、编辑器问题修复。
5. `M4-ai-chat-sse.md`：AI Chat 后端模型、真实 LLM SSE、前端 Panel、模型选择和体验收尾。
6. `M5-rag-worker-qdrant.md`：RAG 知识库、Worker、Qdrant、文档索引和基于文档问答规划。
7. `M6-search-workspace-polish.md`：全局搜索、Command Palette、回收站、收藏和发布页面规划。
8. `M7-realtime-deployment-testing.md`：实时事件、部署准备、健康检查和测试补强。
9. `M8-native-mobile.md`：原生移动端 App，覆盖登录、文档、搜索、AI、轻编辑和分发规划。
10. `engineering-ui-rules.md`：shadcn/ui、Tailwind、i18n、ahooks、Trae rules、代码生成规范。

## 当前总状态

- M0、M1、M2、M3 已形成可运行闭环。
- M4 已完成 AI Chat SSE 的后端和前端闭环，并已接入 OpenAI Compatible streaming client；模型选择、会话标题生成、错误提示和自动滚动体验已收尾。
- M5 已收口完成：文档默认进入知识库、切块、embedding、Qdrant 检索、RAG SSE 问答、引用展示、相似度阈值、AI 面板入口、异步索引 worker 和引用来源定位/高亮均已落地，并通过 RAG smoke、Web build 和 Go tests 验证。
- M6 已完成：全局搜索、Command Palette、回收站、收藏排序和公开页面发布均已落地。
- M7 已开启并完成核心骨架：SSE 实时事件、Docker Compose 部署演示、部署文档和 README 更新已落地，后续优先收口测试补强。
- M8 已加入后续路线：在 Web/Go API 稳定后新增 `apps/mobile` 原生移动端，使用 React Native / Expo，复用 Go API、共享 client 和 shared types。
- 后续 AI 方向已调整为 Agent + Tool 架构：RAG 将作为 `knowledge_base.search` tool，而不是长期独立问答章节；暂不做人工作 query intent 前置规则。
- 规则与工程约束已迁移到项目内 `.trae/rules/`，后续应优先读取项目 rules，而不是依赖全局 memory。

## 关键验证命令

```bash
pnpm --filter @my-notion-go/web typecheck
pnpm --filter @my-notion-go/web build
pnpm build:api
pnpm build:worker
go test ./services/api/...
pnpm smoke:api:documents
pnpm smoke:api:ai-chat
pnpm smoke:api:rag
```

## 原始日志映射

- 原始过程日志仍保留在 `progress/`。
- 每个里程碑文件末尾都列出对应的 `progress/*.md` 来源，便于从摘要跳回完整上下文。
