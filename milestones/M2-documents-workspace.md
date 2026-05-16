# M2 Document CRUD + Workspace

## 阶段目标

完成 Notion 类应用的核心文档能力：Document CRUD、文档树、工作区布局、标题编辑、归档恢复、文档树交互，并尽量对齐原 My-Notion Web 视觉。

## 后端能力

- 新增 Document 模型：`Document`、`DocumentContent`、`DocumentDTO`、`DocumentTreeDTO`。
- 新增 Document repository/service/handler。
- 支持创建文档时同步初始化空正文 `[]`。
- 所有查询使用 `user_id` 过滤，保证用户只能访问自己的文档。
- 支持文档树、详情、回收站、元信息更新、归档/恢复子树、永久删除子树。
- `PATCH /api/v1/documents/:id` 支持 `parentId`，用于移动文档。
- 移动文档时在事务中更新 `parent_id`、`position`、当前文档 path 和所有后代 path。
- 阻止将文档移动到自身或自身后代，避免树结构循环。
- 修复 `buildTree`：通过 parent -> child id 索引递归生成树，避免值拷贝导致深层节点丢失。

## API

- `POST /api/v1/documents`
- `GET /api/v1/documents/tree`
- `GET /api/v1/documents/trash`
- `GET /api/v1/documents/:id`
- `PATCH /api/v1/documents/:id`
- `POST /api/v1/documents/:id/archive`
- `POST /api/v1/documents/:id/restore`
- `DELETE /api/v1/documents/:id`

## 前端能力

- 首页、登录弹窗、工作区、文档树、空状态页对齐原 My-Notion 视觉。
- 复用原项目静态资产：logo、documents、reading、empty 的 light/dark 版本。
- 实现主题切换：Zustand + localStorage + `document.documentElement.classList`。
- `packages/api-client` 新增 Document 类型和 API。
- `DocumentWorkspace` 负责数据编排、React Query、mutation 和路由跳转。
- `WorkspaceSidebar` 展示用户区、基础入口、文档树和底部操作。
- `DocumentTree` / `DocumentTreeItem` 支持递归渲染、展开折叠、当前态。
- `DocumentNavbar` / `DocumentNavbarTitle` 支持顶部栏、主题切换、归档入口。
- `DocumentDetail` 支持标题展示、更新时间展示和内联标题编辑。
- `EmptyDocuments` 使用原 My-Notion empty 插画。
- 支持新建根文档、新建子文档、点击进入文档、标题编辑、归档。
- 支持文档树 hover 后显示更多菜单和添加子页面。
- 使用 `RenameDocumentDialog` 替代 `window.prompt`。
- 恢复 HTML5 拖拽移动文档：拖动源文档到目标文档行后调用后端移动接口。

## UI/交互演进

- 最初使用手写 CSS 和局部 Radix 风格组件快速完成 Notion-like 工作区。
- 后续引入本地 shadcn/Radix 风格 `Dialog` 和 `DropdownMenu`。
- 文档树操作最终对齐原 My-Notion：
  - hover 显示 `MoreHorizontal`。
  - 重命名放入 dropdown。
  - hover 显示 `Plus` 添加子页面。
  - 拖拽移动文档。

## 验证

- `services/api/docs/documents.http` 覆盖文档 CRUD、树、详情、归档、回收站、恢复、删除。
- 新增 `scripts/smoke-documents-api.mjs` 自动验证文档 API 链路。
- 新增 `pnpm smoke:api:documents`。
- `go test ./services/api/...` 通过。
- `pnpm --filter @my-notion-go/web typecheck` 通过。
- `pnpm --filter @my-notion-go/web build` 通过。
- 文档树深层结构回归测试通过。

## 关键经验

- Document 工作区不能做成通用 SaaS dashboard，要对齐原 My-Notion 的文档树和编辑区布局。
- 文档树构建不要提前把值 append 到父节点，应使用索引递归组装，避免深层节点丢失。
- 拖拽移动需要保留 `Link draggable={false}`，避免浏览器把链接拖成拆分视图。
- 前端复杂页面要拆分 container / presentational / hooks / types / queryKeys，避免单文件膨胀。

## 来源日志

- `progress/20260515-085130.md`
- `progress/20260515-113413.md`
- `progress/20260515-120239.md`
- `progress/20260515-125148.md`
- `progress/20260515-152543.md`
- `progress/20260515-225859.md`
- `progress/20260515-230922.md`
- `progress/20260515-233332.md`
- `progress/20260516-095759.md`
