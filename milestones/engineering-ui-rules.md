# Engineering, UI, Rules

## 阶段目标

把项目开发约束从口头约定和过程日志中提炼出来，形成稳定规则；同时把 UI 基建从手写 CSS/Radix 过渡到 shadcn/ui + Tailwind 的项目标准。

## 前端工程约束

- Web 端使用 React Router 管理路由。
- 表单使用 React Hook Form + Zod。
- 全局状态使用 Zustand。
- 请求生命周期、mount-only effect、防抖、节流、定时器、稳定 callback 优先使用 ahooks。
- 用户可见文案必须使用 i18next，并同时维护 `zh` / `en`。
- 业务 React 组件、feature container、请求 hook、路由守卫等需要写中文学习型注释。
- 复杂文件应拆分 container / presentational / hooks / types / queryKeys。

## UI 基建演进

- 早期使用手写 CSS 和少量 Radix 风格本地封装快速实现 Notion-like UI。
- 后续正式采用 shadcn/ui 组件体系：
  - Tailwind CSS v3。
  - PostCSS。
  - `tailwindcss-animate`。
  - `components.json`。
  - `cn()` 工具。
  - TypeScript/Vite `@/*` alias。
- 新增或迁移本地 shadcn 风格组件：
  - `button.tsx`
  - `input.tsx`
  - `textarea.tsx`
  - `dialog.tsx`
  - `dropdown-menu.tsx`
- Auth、导航、空状态、侧边栏、文档树、AI Chat 等交互控件逐步迁移到 `components/ui`。

## Tailwind 收口

- 用户明确要求：不要继续在 `global.css` 中堆 feature 级样式。
- 已将以下模块的大量全局 class 迁移到组件内 Tailwind：
  - `MarketingHome`
  - `AuthDialog`
  - `LoadingScreen`
  - `WorkspaceSidebar`
  - `DocumentWorkspace`
  - `DocumentNavbar`
  - `DocumentNavbarTitle`
  - `DocumentTree`
  - `DocumentTreeItem`
  - `DocumentTreeActions`
  - `DocumentDetail`
  - `DocumentEditor`
  - `EmptyDocuments`
  - `TreeSkeleton`
  - `LanguageToggle`
  - `AIChatPanel`
- 当前 `global.css` 只保留：
  - Tailwind directives。
  - design tokens 和 dark tokens。
  - reset/base。
  - logo dark/light 切换。
  - BlockNote `.bn-*` 第三方覆盖。
  - `blink` 动画。
  - 小屏 body overflow 修正。

## Trae Rules 本地化

- 用户指出规则不应写到全局 memory，应按 Trae 官方项目规则写到项目目录。
- 已撤销误写入全局 memory 的新增规则。
- 新增项目规则目录：
  - `.trae/rules/frontend-engineering.md`
  - `.trae/rules/project-workflow.md`
- 两个规则都使用：

```markdown
---
alwaysApply: true
---
```

## 当前项目 Rules 要点

- 新增前端组件样式优先使用 Tailwind utility class。
- 禁止为单个 feature 新增大段 global CSS。
- 交互控件必须优先使用 `apps/web/src/components/ui` 下的 shadcn 风格本地组件。
- 缺少 UI primitive 时先补本地组件封装。
- 用户可见文案必须使用 `react-i18next`，并补齐 `resources.ts` 的 `zh/en`。
- feature hook 的生命周期清理优先使用 `useUnmount`。
- 稳定事件回调优先使用 `useMemoizedFn`。
- 网络请求必须检查 HTTP 状态和错误响应。
- SSE/streaming 不能复用 JSON envelope 时，需要在注释中说明原因。
- 新增代码必须为流式解析、缓存同步、鉴权边界、状态同步、并发取消、事务、错误降级等非显然逻辑写简洁注释。
- 前端交付前必须检查 raw interactive controls、硬编码文案、大段 global CSS、缺少 ahooks、缺少关键注释。

## 验证

- 业务组件中 raw `<button>`、`<input>`、`<textarea>` 已清理，只剩 `components/ui` primitive 内部封装。
- 旧 feature class 残留检查通过。
- `pnpm --filter @my-notion-go/web typecheck` 通过。
- `pnpm --filter @my-notion-go/web build` 通过。

## 关键经验

- Skills 更适合提供专项能力和流程提示；长期硬约束应落到 `.trae/rules/`。
- 项目规则应放在项目目录，避免污染全局 memory。
- shadcn/ui 的价值在于本地拥有组件源码，缺少组件时应补本地 primitive，而不是在业务里裸写控件。
- Tailwind-first 可以减少全局 CSS 上下文污染，但第三方库覆盖和 design tokens 仍应保留在全局样式中。

## 来源日志

- `progress/20260513-092606.md`
- `progress/20260514-231342.md`
- `progress/20260515-113413.md`
- `progress/20260515-120239.md`
- `progress/20260515-125148.md`
- `progress/20260515-230922.md`
- `progress/20260515-233332.md`
- `progress/20260516-102305.md`
- `progress/20260516-103102.md`
- `progress/20260516-111742.md`
- `progress/20260516-113241.md`
