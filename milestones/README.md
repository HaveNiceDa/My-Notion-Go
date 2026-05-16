# My-Notion Go 里程碑索引

## 目的

`progress/` 保留按时间叙事的详细过程日志，适合追溯每次改动。

`milestones/` 用于把这些过程日志收敛成阶段性结论，适合后续喂给 AI 快速理解项目状态，减少上下文噪音。

## 阅读顺序

1. `M0-project-foundation.md`：工程骨架、monorepo、Docker、Go/Web 基础启动。
2. `M1-auth-database.md`：PostgreSQL migration、Auth 后端、Auth 前端、CORS 联调。
3. `M2-documents-workspace.md`：Document CRUD、Notion-like 工作区、文档树交互。
4. `M3-editor-blocknote.md`：Content API、BlockNote、JSONB 自动保存、编辑器问题修复。
5. `M4-ai-chat-sse.md`：AI Chat 后端模型、mock SSE、前端 Panel 最小闭环。
6. `engineering-ui-rules.md`：shadcn/ui、Tailwind、i18n、ahooks、Trae rules、代码生成规范。

## 当前总状态

- M0、M1、M2、M3 已形成可运行闭环。
- M4 已完成 mock SSE 的后端和前端最小闭环，尚未接真实 LLM。
- 规则与工程约束已迁移到项目内 `.trae/rules/`，后续应优先读取项目 rules，而不是依赖全局 memory。

## 关键验证命令

```bash
pnpm --filter @my-notion-go/web typecheck
pnpm --filter @my-notion-go/web build
pnpm build:api
go test ./services/api/...
pnpm smoke:api:documents
pnpm smoke:api:ai-chat
```

## 原始日志映射

- 原始过程日志仍保留在 `progress/`。
- 每个里程碑文件末尾都列出对应的 `progress/*.md` 来源，便于从摘要跳回完整上下文。
