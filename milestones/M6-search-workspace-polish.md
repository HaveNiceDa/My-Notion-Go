# M6 Search + Workspace Polish

## 阶段目标

M6 用于补齐 Notion-like 工作区的基础产品能力：全局搜索、Command Palette、回收站入口、收藏入口和发布页面。

本阶段优先从 `M6.0 Search + Command Palette` 开始。搜索先使用 PostgreSQL 完成最小闭环，后续再评估是否切换到 Elasticsearch。

## 搜索引擎取舍

### 当前采用 PostgreSQL

- 依赖少：项目已有 PostgreSQL，不需要新增 ES 集群、索引同步和运维配置。
- 数据隔离直接：所有查询天然带 `user_id` 条件，符合当前项目的数据隔离硬约束。
- 足够 MVP：标题搜索和正文 JSONB 弱匹配可以支撑 Command Palette 的快速跳转。
- 易验证：可直接复用现有 document smoke，不需要额外启动搜索基础设施。

### 预留 Elasticsearch

- API 返回 `DocumentSearchResult`，前端不直接感知底层搜索引擎。
- 后端搜索入口集中在 Document Service/Repository，后续可替换为 Search 模块或 ES adapter。
- 如果引入 ES，必须同步设计：
  - PostgreSQL -> ES 的异步索引任务。
  - 文档归档、删除、重命名和正文保存后的索引更新。
  - `user_id` filter、权限字段和索引清理。
  - 本地 Docker Compose、smoke 和部署配置。

## M6.0 范围

- 后端：
  - `GET /api/v1/documents/search?q=&limit=&includeArchived=`
  - 标题命中优先，正文 JSONB 文本匹配兜底。
  - 默认不搜索归档文档。
  - 默认 limit 为 20，上限为 50。
- 前端：
  - 侧边栏搜索按钮打开 Command Palette。
  - 支持 `Cmd/Ctrl + K` 快捷键。
  - 输入关键词后搜索并跳转文档。
  - 所有文案进入 `resources.ts` 的 `zh/en`。
- 验证：
  - `pnpm smoke:api:documents` 覆盖标题和正文搜索。
  - `go test ./services/api/...`
  - `pnpm --filter @my-notion-go/web typecheck`
  - `pnpm build:api`

## 后续 M6.1+

- 回收站页面：侧边栏入口、恢复、永久删除确认。
- 收藏页面：按 `is_starred` 展示收藏文档。
- 搜索增强：PostgreSQL `pg_trgm` / `tsvector`，或按规模切到 Elasticsearch。
- 发布页面：公开访问路由、匿名读取权限和撤销发布。

## 当前状态

- M6.0 已开启。
- 搜索方案确定为 PostgreSQL 优先、ES 预留。
- M6.1 已开启：
  - 侧边栏新增回收站入口。
  - 前端新增回收站视图，展示已归档文档。
  - 回收站支持恢复文档和永久删除确认。
- M6.2 已开启：
  - 侧边栏新增收藏分组，与 `Private` 同层级展示收藏文档。
  - 收藏列表从文档树派生 `isStarred` 文档，不新增后端请求。
  - 收藏 item 支持后端持久化拖拽排序，不改变文档父子关系。
  - 文档树更多菜单和顶部栏支持加入收藏/取消收藏。
