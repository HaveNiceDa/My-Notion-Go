# M3 Editor + BlockNote + JSONB Autosave

## 阶段目标

完成文档正文编辑 MVP：后端 JSONB Content API、前端 BlockNote 编辑器、自动保存、国际化，并修复 BlockNote/ProseMirror 版本兼容问题。

## 后端能力

- 新增 Document Content repository/service/handler。
- 新增接口：
  - `GET /api/v1/documents/:id/content`
  - `PUT /api/v1/documents/:id/content`
- 保存前校验 `user_id + document_id`，确保用户只能访问自己的正文。
- 校验正文必须是合法 JSON，且顶层必须是数组，以匹配 BlockNote root blocks。
- 保存正文到 `document_contents.content`。
- 保存时生成 `sha256` content hash。
- 保存时递增 `version`。
- 响应中保留 `contentHash`、`version`、`updatedAt`，为后续冲突检测和同步调试预留。
- `DocumentContentDTO.content` 使用 `json.RawMessage` 返回，避免 Go `[]byte` 被编码成 base64。

## 前端能力

- 安装并接入 BlockNote：
  - `@blocknote/core`
  - `@blocknote/react`
  - `@blocknote/mantine`
  - `@mantine/core`
  - `@mantine/hooks`
  - `@mantine/utils`
- `packages/api-client` 新增 `DocumentContent`、`UpdateDocumentContentRequest` 和 content API。
- `useDocumentContent` 使用 React Query 读取正文。
- `useAutosaveDocumentContent` 使用 mutation 保存正文。
- 自动保存使用 `ahooks/useDebounceFn` 做 900ms 防抖。
- 自动保存状态包括 `idle`、`saving`、`saved`、`error`。
- `DocumentEditor` 负责读取正文、加载态、错误态。
- `BlockNoteEditorSurface` 负责初始化 BlockNote 并监听内容变化。
- 切换文档时通过 `key={documentId}` 重新挂载编辑器，避免复用上一篇文档本地状态。

## BlockNote 国际化

- `DocumentEditor.tsx` 引入 `@blocknote/core/locales` 的 `zh` 和 `en` 字典。
- 根据 `i18n.language` 选择 BlockNote 字典。
- 复用项目 `editor.placeholder` 覆盖 BlockNote 字典里的 `placeholders.default` 和 `placeholders.emptyDocument`。
- 语言切换后，BlockNote UI 文案跟随项目语言更新。

## 关键问题与修复

- 打开文档详情页曾出现 `RangeError: Invalid array passed to renderSpec`。
- 最初排查过后端脏数据、React Query 缓存、StrictMode、Mantine UI 层。
- 通过官方最小 demo 复现后确认不是业务代码问题。
- 根因是依赖解析到了 `prosemirror-model@1.25.5`，而原 My-Notion 可运行版本使用 `1.25.4`。
- 修复方式是在根 `package.json` 的 `pnpm.overrides` 固定：
  - `prosemirror-model: 1.25.4`
- 删除临时 `DOMSerializer.renderSpec` shim 和最小 demo 页面。
- 恢复 BlockNote 官方推荐用法。
- 恢复默认 formatting toolbar 和 slash menu。

## 验证

- `services/api/docs/documents.http` 增加 content 读写示例。
- `scripts/smoke-documents-api.mjs` 覆盖正文读取和更新。
- `pnpm --filter @my-notion-go/web why prosemirror-model` 确认解析为 `1.25.4`。
- `go test ./services/api/...` 通过。
- `pnpm --filter @my-notion-go/web typecheck` 通过。
- `pnpm --filter @my-notion-go/web build` 通过。
- 用户确认编辑器正常，不再出现 renderSpec 报错。

## 已知边界

- 当前保存整篇 BlockNote document，没有冲突检测。
- 后续协同编辑需要更细粒度同步策略。
- `pnpm build:web` 会有 BlockNote chunk size warning，当前不影响功能。
- 后续可考虑动态加载 editor 或 Rollup manualChunks。

## 来源日志

- `progress/20260515-131753.md`
- `progress/20260515-152543.md`
- `progress/20260515-222641.md`
- `progress/20260515-224236.md`
- `progress/20260516-103730.md`
