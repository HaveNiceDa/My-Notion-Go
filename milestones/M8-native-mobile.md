# M8 Native Mobile App

## 阶段目标

M8 用于在 Web MVP、实时事件、部署和测试闭环稳定后，新增 `my-notion-go` 的原生移动端实现。

移动端不复用现有 My-Notion 主工程的 Expo 代码，也不把 Web 页面简单包成 WebView。第一版采用 React Native / Expo 新建 `apps/mobile`，复用 Go API、共享类型和 API client，逐步补齐 Notion-like 的移动端阅读、搜索、AI 和轻编辑体验。

## 设计原则

- Web 先行：M8 不阻塞 M7 的部署、测试和稳定性收口。
- 原生优先：主导航、登录态、列表、搜索、AI 对话和设置页使用 React Native 原生组件实现。
- 后端复用：移动端连接同一套 Go API，继续遵守 `userId` 数据隔离、JWT 鉴权、RAG 阈值和 SSE 鉴权约束。
- 客户端共享：优先复用 `packages/api-client` 和 `packages/shared`，避免 Web/Mobile 各自维护重复 DTO。
- 富文本分阶段：BlockNote 不直接适配 React Native，移动端先做只读和轻编辑，再评估原生 block editor 或受控 WebView editor。
- 持久化优先：移动端排序、收藏、发布状态等仍以后端数据库为准，不把业务状态仅保存在本地缓存。

## 技术选型

- App 框架：React Native + Expo。
- 路由：Expo Router。
- 语言：TypeScript。
- 服务端状态：TanStack Query。
- 本地状态：Zustand。
- 样式：NativeWind 或同等 Tailwind-like 原生样式方案。
- 安全存储：使用系统安全存储保存 refresh token，access token 优先内存态和短期恢复。
- API：复用 OpenAPI 生成 client 或封装移动端 adapter。
- 流式响应：优先验证 React Native 环境下 `fetch` + streaming；如运行时不稳定，提供降级策略。

## M8.0 App Foundation

- 新增 `apps/mobile` workspace。
- 初始化 Expo Router、TypeScript、Lint/Typecheck、基础环境变量。
- 打通 `EXPO_PUBLIC_API_BASE_URL`。
- 接入共享 API client 和 shared types。
- 建立移动端主题、基础布局、错误边界和 loading/empty/error 状态。

## M8.0 当前状态

- 已新增 `apps/mobile` workspace，使用 Expo + Expo Router + TypeScript。
- 已新增根脚本：
  - `pnpm dev:mobile`
  - `pnpm typecheck:mobile`
  - `pnpm lint:mobile`
- 已打通 `EXPO_PUBLIC_API_BASE_URL`，并让 `packages/api-client` 同时兼容 Web 的 `VITE_API_BASE_URL` 与移动端的 `EXPO_PUBLIC_API_BASE_URL`。
- 已接入 `@tanstack/react-query`，在根布局注入 `QueryClientProvider`，为后续 Auth、Documents 和 AI 请求做准备。
- 已建立双端共享 i18n 基线，文案资源集中在 `packages/shared/src/i18n/resources.ts`，Web 和 Mobile 均从 `@my-notion-go/shared` 复用。
- 已建立第一版 Notion-like 移动端欢迎页，展示 API 地址和 M8.1 准备状态。
- 已通过：
  - `pnpm typecheck:mobile`
  - `pnpm lint:mobile`

## M8.1 Auth + Session

- 实现登录、注册、退出登录。
- 实现 access token 注入、refresh token 刷新和登录态恢复。
- 使用安全存储保存敏感 token，避免把 token 明文放入普通持久化 store。
- 处理 401、网络不可用、API 地址错误等基础异常。

## M8.1 当前状态

- 已接入 `expo-secure-store`，移动端 refresh token 使用系统安全存储；当运行环境不支持 SecureStore 时，仅使用内存降级，不做普通持久化。
- 已新增移动端 auth store，集中处理登录、注册、退出登录、启动恢复、refresh token 续期和 401 后一次刷新重试。
- 已将 access token 保持在内存态，并提供 `runWithAuth`，后续 M8.2 Documents 和 M8.4 AI 请求可复用同一个鉴权入口。
- 已将移动端首页从 M8.0 欢迎页升级为 M8.1 会话入口：启动恢复中、未登录表单、已登录工作区占位三态切换。
- 已复用 `packages/shared/src/i18n/resources.ts` 管理移动端新增文案，继续不引入 `zh-TW`。
- 已通过：
  - `pnpm typecheck:mobile`

## M8.1.5 Mobile UI Foundation

### 目标

- 在 M8.2 文档阅读路径前建立移动端 UI 基线，避免后续文档列表、阅读页、搜索入口和确认弹层继续手写零散组件。
- 采用 `NativeWind` + `react-native-css` + Tailwind CSS v4，保持与 Web 端 Tailwind/shadcn 心智一致。
- 建立移动端自己的 `components/ui` 基础组件层，业务页面优先复用 UI primitive，不直接堆叠 `Pressable`、`TextInput` 和大段 inline style。

### 任务卡片

- 配置 Tailwind CSS v4、NativeWind Metro transformer、PostCSS 和全局 CSS 入口。
- 建立 `src/tw` CSS-enabled React Native primitives，集中导出 `View`、`Text`、`Pressable`、`TextInput`、`ScrollView` 等基础元素。
- 建立 `src/components/ui` 基础组件：`Button`、`Input`、`Card`、`ScreenScrollView` 和 `LoadingCard`。
- 抽取 Notion-like 移动端设计 token，包括背景、卡片、弱底色、边框、正文、次级文本和危险色。
- 将 M8.1 登录页和工作区占位页迁移到新 UI 基线，作为 M8.2 继续开发的样例。

### 验收标准

- `apps/mobile` 可以通过 `className` 使用 Tailwind utility。
- 登录、注册、会话恢复、已登录首页仍保持现有行为。
- `pnpm --filter @my-notion-go/mobile typecheck` 通过。
- `pnpm --filter @my-notion-go/mobile lint` 通过或记录明确的阻塞原因。
- Expo Go 与 Expo Web 均能启动；Web 预览继续使用 `8081`。

## M8.2 Documents Mobile Read Path

- 实现文档列表、文档树、最近文档和收藏入口。
- 实现文档详情只读页，支持标题、icon、cover、更新时间和正文渲染。
- 实现搜索入口，复用 `GET /api/v1/documents/search`。
- 实现回收站基础查看、恢复和永久删除确认。
- 实现公开链接打开和 deep link 预留。

## M8.2 当前状态

- 已新增移动端文档列表 UI 结构，包含阶段头图、快捷入口、最近文档、收藏文档、全部文档树、空态、错误态和加载态。
- 已新增 `useMobileDocumentTree`，通过 React Query + `runWithAuth` 复用 M8.1 的 access token 注入、401 refresh 和单次重试逻辑。
- 已将登录后的移动端入口从 M8.1 占位页切换到文档列表页，同时保留账号、API 地址和退出登录入口。
- 已复用 `packages/shared/src/i18n/resources.ts` 新增移动端文档列表文案，继续只维护 `zh` / `en`。
- 已新增 `/documents/[documentId]` 移动端动态路由，列表项可跳转到文档详情只读页。
- 已新增文档详情 metadata 和正文 content 查询，继续复用 React Query + `runWithAuth` 的鉴权刷新链路。
- 已实现 BlockNote JSON 的移动端只读降级渲染，支持段落、标题、列表、引用、代码块和子块缩进；未知 block 显示安全占位文案。
- 已新增 `/search` 移动端搜索入口，复用 `GET /api/v1/documents/search` 并支持结果跳转详情页。
- 已新增 `/trash` 移动端回收站基础查看，复用 `GET /api/v1/documents/trash` 展示归档文档列表。
- 已新增 `/public/[publicId]` 公开页面预留路由，复用公开文档 API 并支持后续 `mynotiongo://public/:publicId` deep link 映射。
- 已补齐移动端回收站恢复和永久删除动作，复用 `POST /api/v1/documents/:id/restore` 与 `DELETE /api/v1/documents/:id`，成功后刷新回收站、文档树、搜索和详情缓存。
- 已在移动端文档详情页为已发布文档补充公开链接复制和打开公开页入口；复制链接依赖 `EXPO_PUBLIC_WEB_BASE_URL`，本地默认从 API 地址推导到 Web `5273`。
- 已通过：
  - `pnpm --filter @my-notion-go/mobile typecheck`
  - `pnpm --filter @my-notion-go/mobile lint`
- M8.2 文档阅读路径已完成推荐收口，下一步可进入 M8.3 Mobile Editor MVP 方案确认。

## M8.3 Mobile Editor MVP

- 第一版支持标题、icon、收藏、发布状态等文档元信息编辑。
- 正文编辑先做轻编辑能力，避免一次性实现完整 BlockNote 兼容。
- 保存正文仍走 `PUT /api/v1/documents/:id/content`，并保留 `content_hash` / `version` 冲突检测扩展点。
- 若采用 WebView editor，必须明确边界：只承载编辑器内核，不把整个 App 退化成 WebView。

## M8.3 具体实现方案

- 页面入口：继续复用 `/documents/[documentId]`，在只读详情页头部和正文之间新增 `DocumentMetadataEditor` 卡片。
- 编辑范围：第一版只编辑文档元信息，包括 `title`、`icon`、`isStarred` 和 `isPublished`；正文仍由 `ReadonlyDocumentContent` 只读渲染。
- 请求链路：
  - 标题和 icon 走 `PATCH /api/v1/documents/:id`，请求体使用 `UpdateDocumentRequest`。
  - 收藏切换走同一个 `PATCH /api/v1/documents/:id`，只提交 `isStarred`。
  - 发布切换走 `POST /api/v1/documents/:id/publish` 和 `DELETE /api/v1/documents/:id/publish`。
- 鉴权边界：所有受保护请求继续通过移动端 `runWithAuth` 执行，保留 access token 注入、401 静默 refresh 和单次重试。
- 缓存同步：新增 `useMobileDocumentActions`，成功后同步当前详情缓存，并 invalidate 文档树、搜索结果和公开页详情缓存。
- UI 结构：
  - `CardEyebrow` 展示 M8.3 阶段标签。
  - `Input` 编辑标题和 icon。
  - 主按钮保存标题/icon。
  - 两个次级按钮分别切换收藏和发布状态。
  - 页面内 `InfoCard` 展示保存、收藏、发布的成功或失败反馈。
- 当前不做：正文 block 编辑、WebView editor、冲突检测 UI、多人协同和离线编辑队列。

## M8.4 AI + RAG Mobile

- 实现 AI Chat 移动端入口和会话列表。
- 支持普通 AI 对话、RAG 问答和引用来源展示。
- 流式响应需继续支持 Bearer Token；如果 React Native streaming 能力不足，提供非流式或轮询降级方案。
- 后续 Agent + Tool 架构落地后，移动端只消费统一 Agent SSE / event 协议。

## M8.5 Mobile Polish

- 支持离线弱提示和网络恢复后的 query invalidation。
- 支持系统分享、复制公开链接和打开公开页。
- 支持基础 deep link。
- 评估 push notification，用于任务完成、共享邀请或未来协作通知。
- 补充 EAS build / iOS / Android 构建说明。

## 验证命令

```bash
pnpm --filter @my-notion-go/mobile typecheck
pnpm --filter @my-notion-go/mobile lint
pnpm --filter @my-notion-go/mobile test
```

如果移动端包尚未建立，上述命令作为 M8.0 的目标命令；落地前不要求当前仓库通过。

## 当前不做

- 不复用旧 My-Notion Expo 工程。
- 不在 M8.0 直接实现完整富文本协同编辑。
- 不把文档排序、收藏排序等业务状态仅保存在本地缓存。
- 不在移动端绕过 Go API 直连 PostgreSQL、Qdrant 或 LLM。
- 不在第一版移动端引入多人协同编辑、在线光标或 CRDT。

## 剩余待办

- 确认 `apps/mobile` 的包名、bundle identifier 和 EAS project 配置。
- 确认移动端 editor 方案：原生 block editor、轻编辑或受控 WebView editor。
- 确认 React Native 运行时对 SSE / streaming fetch 的支持情况。
- 设计移动端多设备退出策略和 refresh token 失效后的用户提示细节。
- 设计移动端离线缓存边界，避免与后端持久化状态冲突。
