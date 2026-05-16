---
alwaysApply: true
---

# Project Workflow Rules

## 项目结构

- `my-notion-go` 是独立 monorepo，使用 `pnpm workspaces` 和 `go work`。
- Web 端位于 `apps/web`，后端 API 位于 `services/api`，共享客户端位于 `packages/api-client`。
- 后端保持 `cmd/` 入口和 `internal/` 模块分层，业务模块按 `repository/service/handler` 组织。

## 技术约束

- 数据库使用 PostgreSQL + GORM，文档正文使用 JSONB。
- 编辑器使用 BlockNote，保持 `prosemirror-model` 版本固定，避免编辑器渲染回归。
- UI 需要保持 Notion-like 视觉，并尽量对齐原 My-Notion 工作区体验。

## 进度与验证

- 重要阶段性改动需要在 `progress/` 下新增 Markdown 记录。
- API 手测文件放在 `services/api/docs/*.http`。
- 自动化 smoke 脚本放在 `scripts/`，并在根 `package.json` 中暴露 `pnpm smoke:*` 命令。
- 修改后应根据影响范围运行对应验证；至少运行相关 typecheck/build/test，无法运行时说明原因。
