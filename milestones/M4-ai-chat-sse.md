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
- `POST /api/v1/ai/chat/stream` 当前返回 mock assistant 流式响应，不调用真实 LLM。
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

## 后续

- 浏览器真实验证 AI 面板交互、SSE 流式显示和刷新后历史消息恢复。
- 接入真实 OpenAI Compatible API streaming client。
- 增加会话标题生成、滚动到底、错误提示体验、Thinking Steps 和模型配置。

## 来源日志

- `progress/20260516-104317.md`
- `progress/20260516-110221.md`
- `progress/20260516-111742.md`
