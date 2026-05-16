# M4 AI Chat + SSE

## 阶段目标

进入 AI Chat 阶段，先完成后端会话/消息模型、mock SSE 流式接口和前端 AI Chat Panel 最小闭环，再为后续接入真实 OpenAI Compatible API 做准备。

## 后端能力

- 新增 AI Chat migration：
  - `ai_conversations`
  - `ai_messages`
  - `ai_thinking_steps`
- 新增 `services/api/internal/chat` 模块：
  - `models.go`
  - `repository.go`
  - `service.go`
  - `handler.go`
- 注册受保护 AI 路由：
  - `GET /api/v1/ai/conversations`
  - `POST /api/v1/ai/conversations`
  - `GET /api/v1/ai/conversations/:id/messages`
  - `POST /api/v1/ai/chat/stream`
- `POST /api/v1/ai/chat/stream` 支持 OpenAI Compatible 真实流式响应。
- 未配置 `LLM_API_KEY` 时自动保留 mock fallback，方便本地开发和 smoke 测试。
- 用户消息和 assistant 完整消息会落库。

## SSE 事件协议

- `conversation`：当前会话。
- `user_message`：已保存的用户消息。
- `message`：mock assistant 分段 delta。
- `assistant_message`：已保存的 assistant 完整消息。
- `done`：本轮流式响应结束。

## 自动化验证

- 新增 `services/api/docs/ai-chat.http`。
- 新增 `scripts/smoke-ai-chat-api.mjs`。
- 新增 `pnpm smoke:api:ai-chat`。
- smoke 覆盖登录、建会话、SSE 输出、消息落库。
- 验证结果中曾创建会话并收到 21 个 `message` delta，消息列表返回 user + assistant 两条消息。

## 前端能力

- `packages/api-client` 新增 AI Chat 类型和 JSON API：
  - `AIConversation`
  - `AIMessage`
  - `aiChatApi.conversations`
  - `aiChatApi.createConversation`
  - `aiChatApi.messages`
- 新增 `apps/web/src/features/ai-chat/sse.ts`：
  - 增量解析 `text/event-stream`。
  - 处理 chunk 边界不完整场景。
- 新增 `apps/web/src/features/ai-chat/api.ts`：
  - 使用原生 `fetch + ReadableStream` 调用 `/api/v1/ai/chat/stream`。
  - SSE 不能复用 JSON envelope 拆包逻辑，因此单独封装。
- 新增 `useAIChat`：
  - 读取会话列表。
  - 读取当前会话消息。
  - 发送消息并维护流式 assistant 临时消息。
  - 支持停止当前流式请求。
  - 使用 `useMemoizedFn` 和 `useUnmount` 管理稳定回调和卸载清理。
- 新增 `AIChatPanel`：
  - 右侧 AI 面板。
  - 会话列表。
  - 消息列表。
  - 输入框。
  - 发送/停止按钮。
- 在 `DocumentNavbar` 新增 AI 入口。
- 在 `DocumentWorkspace` 挂载右侧 `AIChatPanel`。
- `resources.ts` 新增 `zh/en` 两套 `aiChat` 文案。

## UI 收口

- 新增 `components/ui/textarea.tsx`，对齐 shadcn/ui 本地组件模式。
- AI Chat 会话列表项使用 `Button`。
- 输入框使用 `Textarea`。
- 面板样式改为 Tailwind class，删除 `.ai-chat-*` 大段全局 CSS。
- 补充面板卸载、提交清空输入框、SSE stream、临时 assistant 消息替换等关键注释。

## 验证

- `go test ./...` 通过。
- `pnpm build:api` 通过。
- `pnpm migrate:api` 通过。
- `pnpm smoke:api:ai-chat` 通过。
- `pnpm --filter @my-notion-go/web typecheck` 通过。
- `pnpm --filter @my-notion-go/web build` 通过。
- AI Chat feature 中已无 raw `<button>`、`<textarea>` 和 `.ai-chat-*` 残留。

## M4.1 真实 LLM 接入

- 新增 `services/api/internal/ai`，使用 Go 标准库调用 OpenAI Compatible `/chat/completions`。
- 支持 `stream: true`、`text/event-stream`、`data: [DONE]` 和 `choices[].delta.content` 解析。
- 配置项：
  - `LLM_API_KEY`
  - `LLM_BASE_URL`
- 兼容环境变量别名：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `DASHSCOPE_API_KEY`
- 模型不再通过环境变量配置，改为代码内白名单和前端 AI 面板选择。
- 前端 AI 面板使用 shadcn `DropdownMenu` 切换模型，并将用户选择持久化到 `localStorage`。
- AI 面板支持右侧宽度拖拽，限制在 `320px` 到 `520px`，避免覆盖过多编辑区。
- Workspace 左侧 sidebar 支持宽度拖拽，限制在 `220px` 到 `420px`。
- AI 面板样式已参考 Notion AI 做轻量化整理，包括紧凑模型选择、空态建议和圆角输入框。
- 可选模型：
  - `deepseek-v4-pro`
  - `qwen3.6-27b`
  - `kimi-k2.6`
  - `glm-5.1`
- assistant 消息 metadata 会记录 `provider` 和 `model`。
- 已新增后端 AI 包单测和 Playwright E2E 测试。
- Playwright E2E 已覆盖首页注册/登录、工作区布局拉伸、AI 面板模型切换和 SSE 请求模型透传。

## M4.2 AI Chat 体验收尾

- 后端新增会话标题生成收口：
  - 手动新建的占位会话收到首条用户消息后，会自动用消息摘要更新标题。
  - 标题更新通过 SSE `conversation` 事件同步到前端会话列表和面板顶部。
  - 标题更新只允许作用于当前用户自己的会话，避免跨用户改名。
- 前端补齐消息体验：
  - 消息列表新增底部滚动锚点。
  - 流式 delta、发送状态变化和错误提示出现时自动滚动到底部。
  - 流式错误时清理临时 assistant 消息，避免错误后残留闪烁光标。
- 错误提示体验：
  - AI 面板新增 `role="alert"` 错误提示条。
  - 错误提示使用 `AlertCircle` 图标和 Tailwind 样式。
  - `resources.ts` 补齐 `zh/en` 的 `aiChat.errorTitle` 和 `aiChat.errorFallback`。
- 已新增阶段日志：
  - `progress/20260516-214800.md`

## M4.2 验证

- `gofmt -w services/api/internal/chat/repository.go services/api/internal/chat/service.go` 通过。
- `pnpm --filter @my-notion-go/web typecheck` 通过。
- `go test ./services/api/...` 通过。
- `pnpm build:api` 通过。
- `pnpm --filter @my-notion-go/web build` 通过。
- `pnpm smoke:api:ai-chat` 通过：
  - authenticated as `demo@example.com`
  - created conversation `89a3a0bb-2b4d-4682-9779-14d9979967e1`
  - conversation list ok, size=11
  - stream ok, delta count=18
  - messages persisted ok, size=2

## 后续

- M4 AI Chat 已具备真实模型流式输出、会话历史、模型选择、基础错误提示和自动滚动体验。
- 后续可在 M5/RAG 阶段继续补 Thinking Steps、Tool Call、文档上下文引用和更细粒度的上游错误透传。
- 下一阶段正式进入 M5：Redis + RabbitMQ Worker + Qdrant + RAG 知识库最小闭环。

## 来源日志

- `progress/20260516-104317.md`
- `progress/20260516-110221.md`
- `progress/20260516-111742.md`
- `progress/20260516-123227.md`
- `progress/20260516-214800.md`
