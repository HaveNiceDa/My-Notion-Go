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
- 移动端不承载公开文档打开、公开链接复制和 public deep link；公开页面保留 Web 端能力。

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
- 已移除移动端公开页面路由；移动端仅保留发布状态展示与切换，不提供公开链接打开能力。
- 已补齐移动端回收站恢复和永久删除动作，复用 `POST /api/v1/documents/:id/restore` 与 `DELETE /api/v1/documents/:id`，成功后刷新回收站、文档树、搜索和详情缓存。
- 已移除移动端文档详情页的公开链接复制和打开公开页入口，避免移动端承担 Web 分享路径。
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

## M8.3.5 Mobile Visual Refactor

### 背景

- 当前 `apps/mobile` 已具备 M8.2 文档阅读路径和 M8.3 元信息编辑能力，但视觉表现仍偏“工程 demo”：
  - 大面积卡片堆叠，缺少 Notion 移动端的页面层级和信息密度。
  - 颜色偏暖偏重，和 `my-notion-go` Web 端以及原 My-Notion 移动端的低对比 Notion-like 风格不一致。
  - 列表 row、section header、icon tile、bottom action、empty/error/loading 组件缺少统一设计语言。
  - 页面标题、卡片标题、按钮权重过重，导致文档工具型产品的“安静感”不足。
- M8.4 AI + RAG Mobile 会新增更复杂页面，如果不先重构视觉系统，后续 AI 页面会继续放大样式债务。

### 参考来源

- 原 My-Notion 移动端：
  - `apps/mobile/src/features/home/components/home-screen.tsx`
  - `apps/mobile/src/features/home/components/home-header.tsx`
  - `apps/mobile/src/features/home/components/recent-section.tsx`
  - `apps/mobile/src/features/home/components/workspace-page-row.tsx`
  - `apps/mobile/src/features/home/components/home-bottom-bar.tsx`
- `my-notion-go` Web 端：
  - `apps/web/src/styles/global.css`
  - `apps/web/src/features/documents/*`
- Notion 原生移动端：
  - 只能参考公开可观察的布局、信息密度和交互习惯。
  - 不复制不可获得的私有设计 token；本项目沉淀自己的 Notion-like token。

### 视觉目标

- 整体气质：更像 Notion 工具 App，而不是营销页或 demo 页。
- 背景：以 `#ffffff` / `#f7f7f5` 为主，避免过重的米色背景。
- 边框：使用 `#e5e5e2` / `#ededeb` 低对比边界，减少强卡片感。
- 字体层级：
  - 页面标题 20-24px，尽量交给原生 Stack title 或轻量 header。
  - section 标题 13-14px，semibold，颜色弱化。
  - row 主标题 15-16px，正文感，不要全页面大标题化。
  - 辅助文字 12-13px，使用 `notion-muted-foreground`。
- 圆角：
  - 文档 row 8-12px。
  - 横向 recent card 14-16px。
  - 底部操作栏 24-28px。
  - 避免所有容器默认 24-28px 大圆角。
- 阴影：
  - 默认不用强阴影。
  - 只在 bottom bar、floating action 或 modal 使用极弱阴影。
- 图标：
  - 优先使用页面 emoji。
  - 无 emoji 时用统一 `PageIcon` / `IconTile`，大小 28-32，背景弱灰。
  - 后续可评估 `expo-image` SF Symbols，但不在本阶段强依赖。

### Token 方案

- 调整 `apps/mobile/src/global.css` 的 Notion token：
  - `notion-bg`: `#ffffff`
  - `notion-canvas`: `#f7f7f5`
  - `notion-surface`: `#ffffff`
  - `notion-hover`: `#f1f1ef`
  - `notion-muted`: `#ededeb`
  - `notion-border`: `#e5e5e2`
  - `notion-text`: `#0a0a0a`
  - `notion-subtle`: `#37352f`
  - `notion-faint`: `#787774`
  - `notion-danger`: `#dc2626`
  - `notion-danger-muted`: `#fef2f2`
- 保留现有 `notion-*` 命名，减少业务 className 改动。
- 新增 spacing 约定：
  - screen horizontal padding: `16`
  - section gap: `8-12`
  - row height: `40-48`
  - compact row padding: `8-10`
  - card padding: `12-16`

### 组件重构清单

- `ScreenScrollView`
  - 默认白底或浅灰 canvas。
  - 统一 `contentContainerStyle` / className 的顶部、底部和横向 padding。
  - 为底部浮动操作栏预留 padding。
- `MobileHeader`
  - 对齐原 My-Notion `HomeHeader`。
  - 左侧 workspace/document context，右侧 search/trash/settings 或文档动作。
  - 减少业务页内重复大标题卡片。
- `Section`
  - 统一 section title、description、右侧 action。
  - 用于 Recent、Favorites、Private、Trash、Editor settings。
- `DocumentRow`
  - 统一文档树、搜索结果、回收站、收藏列表 row。
  - 支持 depth indentation、icon、title、subtitle、right accessory。
  - Pressed 态使用弱灰背景，不使用强边框卡片。
- `RecentCard`
  - 横向滚动卡片，宽度约 136，低边框、弱背景。
  - 对齐原 My-Notion `RecentSection`。
- `IconTile`
  - 统一 emoji / file / folder / database 的视觉容器。
- `BottomActionBar`
  - 对齐原 My-Notion `HomeBottomBar`。
  - 首页提供 search、AI、新建页面。
  - 文档详情可提供 AI、收藏、发布、编辑入口。
- `ActionPill`
  - 用于收藏、发布、知识库状态。
  - 替代当前过重的 full-width button 组合。
- `InlineFeedback`
  - 替代大块 `InfoCard` 成功提示。
  - 成功提示短暂、弱色；错误提示使用 danger muted。

### 页面迁移顺序

- 第一批：UI 基础层
  - `global.css` token 调整。
  - `components/ui/card.tsx` 降低默认圆角、padding、阴影。
  - `components/ui/button.tsx` 支持 `variant`：`primary`、`secondary`、`ghost`、`danger`、`pill`。
  - `components/ui/input.tsx` 降低边框权重和高度。
  - 新增 `section.tsx`、`document-row.tsx`、`icon-tile.tsx`、`bottom-action-bar.tsx`。
- 第二批：首页 / 文档列表
  - `document-list-screen.tsx` 改成 header + recent 横向卡片 + section tree。
  - Quick actions 从三块卡片改成底部或顶部轻量入口。
  - 文档树 row 改为 compact row，支持 depth 和 pressed 态。
- 第三批：文档详情
  - Header 从大卡片改成 cover + icon + title 的 Notion 页面结构。
  - `DocumentMetadataEditor` 从大卡片改成轻量设置 section 或 form sheet 预留。
  - 收藏、发布状态改为 action pill。
- 第四批：搜索 / 回收站
  - 搜索结果统一用 `DocumentRow`。
  - 回收站 row 使用 swipe/action pill 风格预留；第一版可保留按钮但视觉降权。

### 验收标准

- 首页看起来更接近原 My-Notion 移动端：
  - 顶部 workspace header。
  - recent 横向卡片。
  - favorites/private/knowledge section。
  - 底部操作栏。
- 文档列表和搜索结果不再像大卡片 demo，而是像 Notion sidebar/list。
- 文档详情具备 Notion page 感：
  - cover 可选。
  - icon + title 是核心视觉。
  - 元信息编辑入口降权，不抢正文阅读。
- 颜色与 `my-notion-go` Web 端 Notion-like token 对齐。
- `pnpm --filter @my-notion-go/mobile typecheck` 通过。
- `pnpm --filter @my-notion-go/mobile lint` 通过。
- Expo Go / Web 8081 能启动并完成登录、文档列表、详情、搜索、回收站和发布链路手动验收。

### 当前不做

- 不引入完整设计系统库替换 NativeWind。
- 不把整个 App 改成 WebView。
- 不在本阶段实现正文 block 编辑器。
- 不追求 1:1 复刻 Notion 私有视觉 token。
- 不新增复杂动画，先保证静态视觉和布局正确。

### M8.3.5 当前状态

- 已完成第一批 UI 基础层：
  - 调整 `apps/mobile/src/global.css` 的 Notion-like token，背景、弱灰、边框、正文、危险色更贴近 Web 端和 Notion 工具型视觉。
  - 降低 `Card`、`InfoCard`、`Button`、`Input`、`ScreenScrollView` 的默认圆角、padding、阴影和视觉权重。
  - `Button` 新增 `primary`、`secondary`、`ghost`、`danger`、`pill` variants，便于后续统一 action 视觉。
- 已新增移动端复用组件：
  - `Section`
  - `IconTile`
  - `DocumentRow`
  - `BottomActionBar` / `BottomAction`
- 已完成 `DocumentListScreen` 首轮视觉迁移：
  - 顶部从 M8 阶段大卡片改为轻量 workspace header。
  - 最近文档从普通列表改为横向 recent cards。
  - 收藏和全部文档复用 compact `DocumentRow`。
  - Quick actions 改为底部 Notion-like action bar。
  - 账号/API 信息降级为弱提示卡片，不再抢占主视觉。
- 已完成第二批页面迁移：
  - `DocumentDetailScreen` 从大卡片堆叠改为 Notion page 风格，cover、icon、title 成为主体视觉。
  - `DocumentMetadataEditor` 降级为轻量 `Section` + form card，收藏/发布使用 pill action。
  - `DocumentSearchScreen` 使用 `Section` + compact `DocumentRow` 展示搜索结果。
  - `TrashScreen` 使用 `Section` + 紧凑 row 展示回收站文档，恢复/删除按钮降权但保留危险操作强调。
- 已完成详情页信息密度调整：
  - 标题、icon 等页面设置不再以内联大卡片占据详情页布局。
  - 详情页仅保留轻量 `页面设置`、收藏和发布 pill action。
  - 标题/icon 编辑移动到底部弹层式 `Modal` 中，保存成功后自动关闭。
  - 收藏和发布动作在页面轻量入口与设置弹层内均可操作，符合原 My-Notion 的“操作入口轻量、设置内容弹出”的交互方向。
- 已完成第三批“去卡片化”调整：
  - 对齐原 My-Notion 的 `HomeHeader`、`WorkspacePageRow`、`HomeBottomBar` 结构，主页面不再以卡片堆叠为核心。
  - `Section` 改为 plain section，标题不再使用重 uppercase 风格。
  - `DocumentRow` 改为无边框紧凑 row，不再默认用边框分割列表项。
  - `DocumentListScreen` 的收藏/全部文档列表移除圆角边框容器，账号和 API 信息降级为底部弱文本。
  - `DocumentSearchScreen` 移除头部大卡片和搜索结果边框容器，搜索框直接融入页面。
  - `TrashScreen` 移除头部大卡片和列表边框容器，保留危险操作按钮的明确视觉。
  - 设计原则更新为：除 recent cards、底部 action bar、空/错误态外，常规内容优先使用 plain page + section + row，不再堆叠卡片。
- 已完成真实 Web 预览问题修复：
  - `ScreenScrollView` 底部 padding 从 `pb-28` 降为 `pb-8`，避免首页底部 action bar 后出现过多滚动空白。
  - 会话恢复从 `app/index.tsx` 上移到 `app/_layout.tsx`，刷新任意路由都能先恢复 session。
  - `auth-storage` 在 Web 环境下使用 `localStorage` 作为 Expo Web 预览 fallback，解决浏览器刷新后 refreshToken 仅存在内存导致回到登录页的问题。
  - Native 端仍优先使用 `expo-secure-store` 存储 refreshToken，保持移动端安全约束。
- 已完成底部弹层组件化：
  - 新增 `components/ui/bottom-sheet.tsx`，统一遮罩、grabber、标题区、安全区和底部 sheet 视觉。
  - `DocumentDetailScreen` 不再直接手写 `react-native` `Modal` 结构，页面设置弹层统一走 `BottomSheet`。
  - 已切换为原 My-Notion 同款 Tamagui `Sheet` 方案，避免自写 Modal 和 `@gorhom/bottom-sheet` 在 Expo Web 下出现不贴底、滚动手势冲突和输入框不显示问题。
- 已通过：
  - `pnpm --filter @my-notion-go/mobile typecheck`
  - `pnpm --filter @my-notion-go/mobile lint`
- 已完成 Expo Web / Expo Go 真实视觉验收：
  - 登录、文档列表、详情、搜索、回收站、发布状态和底部弹层链路已完成手动检查。
  - 当前视觉重构无阻塞问题，M8.3.5 可收口。
- 下一批进入 M8.4 AI + RAG Mobile，优先验证移动端 SSE / streaming 能力，再落地完整 AI 页面。

## M8.4 AI + RAG Mobile

- 实现 AI Chat 移动端入口和会话列表。
- 支持普通 AI 对话、RAG 问答和引用来源展示。
- 流式响应需继续支持 Bearer Token；如果 React Native streaming 能力不足，提供非流式或轮询降级方案。
- 后续 Agent + Tool 架构落地后，移动端只消费统一 Agent SSE / event 协议。

## M8.4 具体实施方案

### M8.4.0 AI Mobile Design Spike

- 盘点现有 Web AI Chat / RAG API、`packages/api-client` 可复用能力和移动端鉴权入口。
- 确认移动端信息架构：
  - 首页底部 `BottomActionBar` 增加 AI 入口。
  - AI 助手使用底部弹层承载，不从首页跳转到独立页面。
  - 弹层内在会话列表和当前会话聊天视图之间切换。
  - 文档详情页预留“基于当前文档提问”入口。
- 确认移动端交互边界：
  - 第一版以普通对话和 RAG 问答为主，不做复杂 Agent 工具编排 UI。
  - RAG 引用来源以底部引用卡片或消息内 sources 区块展示，点击后跳转文档详情。
  - 长回答优先保证可读性和中断/错误反馈，不追求复杂动画。
- 技术验证：
  - 在 Expo Web 和 Expo Go 中验证 Bearer Token + SSE / streaming fetch 是否可用。
  - 如果 Native streaming 不稳定，设计 `non-streaming` 或短轮询降级接口，不在 UI 层硬编码运行时差异。

### M8.4.1 AI API Adapter

- 在 `apps/mobile` 中新增 AI 请求适配层，继续通过 `runWithAuth` 注入 access token、处理 401 静默刷新和单次重试。
- 优先复用 `packages/api-client` 的类型和请求结构，避免移动端重复定义 DTO。
- 封装会话列表、创建会话、发送消息、RAG 问答和引用来源解析。
- 对 streaming 响应单独封装解析器，并在注释中说明与普通 JSON envelope 不同的原因。
- 错误处理需区分鉴权失败、网络不可用、LLM 配置缺失、RAG 未启用和用户主动取消。

### M8.4.2 Conversation List

- 新增移动端 AI 会话列表页：
  - 使用 `ScreenScrollView`、`Section`、`DocumentRow` / `IconTile` 风格保持 Notion-like 低对比视觉。
  - 展示最近会话、空态、加载态、错误态。
  - 支持创建新会话并跳转聊天页。
- 首页底部操作栏接入 AI 入口，保持文档主路径不被 AI 入口抢占。
- 会话列表刷新策略使用 React Query，登录态变化或退出登录后清理相关缓存。

### M8.4.3 Chat Detail + Streaming

- 新增移动端聊天详情页：
  - 支持用户消息、助手消息、流式生成中状态、错误重试和空态引导。
  - 输入区固定在底部，处理键盘遮挡和安全区。
  - 长消息使用可滚动正文，避免嵌套滚动造成卡顿。
- 支持普通 AI 对话：
  - 发送消息后乐观插入用户消息。
  - 助手消息流式增量更新；降级模式下使用一次性响应。
  - 支持取消当前生成，避免离开页面后继续更新卸载组件。
- 缓存同步：
  - 成功后刷新会话列表和当前会话详情。
  - 失败时保留用户输入和错误提示，便于重试。

### M8.4.4 RAG Sources

- 支持移动端 RAG 问答入口：
  - 可从 AI 首页发起全局知识库问答。
  - 可从文档详情页带入当前文档上下文发起提问。
- 展示引用来源：
  - 消息内展示来源标题、匹配片段和相似度弱提示。
  - 点击引用来源跳转 `/documents/[documentId]`。
  - 如果来源文档不可访问或已删除，展示安全占位，不暴露跨用户数据。
- 数据边界：
  - 所有 RAG 请求继续依赖后端 `userId` 隔离。
  - 移动端不直连 Qdrant，不在本地保存向量或 embedding。

### M8.4 验收标准

- `pnpm --filter @my-notion-go/mobile typecheck` 通过。
- `pnpm --filter @my-notion-go/mobile lint` 通过。
- Expo Web / Expo Go 可完成登录后进入 AI 会话列表。
- 可创建会话、发送普通 AI 消息，并看到助手回复。
- 如果 streaming 可用，助手回复能增量展示；如果不可用，降级路径明确且 UI 无阻塞。
- RAG 问答能展示引用来源，并可从引用跳转到文档详情。
- 401 后仍能通过移动端 refresh token 静默恢复并重试一次。
- 网络错误、LLM 未配置、RAG 未启用时有明确弱提示。
- 退出登录后 AI 会话和消息缓存被清理，不泄露上一个用户数据。

### M8.4 当前不做

- 不实现完整 Agent + Tool 编排 UI。
- 不在移动端直连 LLM、Qdrant、PostgreSQL 或 Worker。
- 不在第一版实现语音输入、图片输入、文件上传或推送通知。
- 不实现离线 AI 队列；网络不可用时只做弱提示和重试入口。
- 不重做 Web AI 页面，除非 API 契约调整必须同步。

### M8.4 当前状态

- 已完成 M8.4 首批基础落地：
  - 首页底部 `BottomActionBar` 的 AI 入口已改为打开底部弹层，不再新开独立路由。
  - 新增 `AIChatSheet`，复用 `BottomSheet`，以约 70% 高度承载会话列表和聊天历史。
  - 新增 `features/ai` 基础模块，包含 query keys、会话列表查询、消息查询和新建会话 mutation。
  - 新增 `mobileAIApi`，复用 `packages/api-client` 的会话和消息 API，并预留普通 AI / RAG SSE streaming adapter。
  - 新增移动端 SSE parser，保持与 Web 端 AI Chat SSE 事件契约一致。
  - AI 弹层内已支持会话列表、新建会话、切换到历史消息展示，发送消息与 streaming UI 留到下一批。
  - 已按原 My-Notion `ChatModal` 调整弹层布局：通用 sheet 只保留 handle，AI 内部自管 header、滚动消息区和底部输入栏，避免新页面感和重复标题。
  - 已接入 `tamagui`、`@tamagui/config`、`@tamagui/animations-react-native`，根布局增加 `TamaguiProvider` 和 `Theme`。
  - 已移除 `@gorhom/bottom-sheet`，AI 弹层回到原 My-Notion 的 Tamagui `Sheet` 结构，滚动区和底部输入框由 sheet frame 内部稳定布局承载。
  - 已移除移动端公开文档能力：删除公开页路由、公开文档 screen/hook、详情页复制公开链接和打开公开页入口。
- 已通过：
  - `pnpm --filter @my-notion-go/mobile typecheck`
  - `pnpm --filter @my-notion-go/mobile lint`
- 下一批建议：
  - 在 Expo Web / Expo Go 中手动验证首页底部 AI 弹层、会话列表、新建会话和历史消息读取。
  - 开始 M8.4.3，补齐底部输入区、普通 AI 发送、streaming 增量展示、取消生成和错误重试。
  - 单独验证 Native 运行时 `fetch` streaming 能力；如果不稳定，再补非流式或轮询降级接口。

## M8.5 Mobile Polish

- 支持离线弱提示和网络恢复后的 query invalidation。
- 移动端暂不支持系统分享、复制公开链接和打开公开页。
- 基础 deep link 仅保留非公开文档路径的后续评估。
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
