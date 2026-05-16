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

## 后续

- 浏览器真实验证 AI 面板交互、SSE 流式显示和刷新后历史消息恢复。
- 增加会话标题生成、滚动到底、错误提示体验、Thinking Steps 和模型配置。
- 进入 M5 前，再手动配置真实 `LLM_API_KEY` 做一次浏览器端模型联调。

## 来源日志

- `progress/20260516-104317.md`
- `progress/20260516-110221.md`
- `progress/20260516-111742.md`
- `progress/20260516-123227.md`
