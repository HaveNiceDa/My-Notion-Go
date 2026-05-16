---
alwaysApply: true
---

# Frontend Engineering Rules

## UI 与样式

- 新增前端组件样式优先使用 Tailwind utility class，直接写在 TSX 的 `className` 中。
- 禁止为单个 feature 新增大段 global CSS；`global.css` 仅保留 design tokens、reset、第三方库覆盖、动画、字体和极高频共享样式。
- 交互控件必须优先使用 `apps/web/src/components/ui` 下的 shadcn 风格本地组件。
- 如果缺少需要的 UI primitive，先在 `apps/web/src/components/ui` 新增本地封装，再在业务组件使用。
- 允许使用 `cn()` 组合条件样式；复杂重复样式优先抽成组件，而不是抽成全局 class。

## 国际化

- 所有用户可见文案必须使用 `react-i18next`。
- 新增文案必须同时补充 `apps/web/src/i18n/resources.ts` 的 `zh` 和 `en`。
- 禁止在组件中硬编码中文或英文产品文案；仅允许技术标识、日志 key、内部常量等非用户文案硬编码。

## Hooks 与请求

- feature hook 的生命周期清理优先使用 `ahooks`，例如 `useUnmount`。
- 稳定事件回调优先使用 `ahooks` 的 `useMemoizedFn`。
- 普通 JSON server state 可以继续使用 React Query；请求副作用、流式请求、生命周期边界仍需遵守 ahooks 约定。
- 网络请求必须检查 HTTP 状态和错误响应；SSE/streaming 不能复用 JSON envelope 拆包逻辑时，需要在代码注释中说明原因。

## 注释

- 新增代码必须为非显然逻辑写简洁、学习型注释。
- 必须注释的场景包括：流式解析、缓存同步、鉴权边界、状态同步、并发/取消、数据库事务、错误降级、跨模块约定。
- 不写“给变量赋值”“调用函数”这类重复代码表面的注释。

## 交付检查

- 前端改动完成前必须检查：是否存在 raw interactive controls、硬编码用户文案、大段新增 global CSS、缺少 ahooks 的生命周期/稳定回调、缺少关键注释。
- 需要运行 `pnpm --filter @my-notion-go/web typecheck`；涉及构建链路时运行 `pnpm --filter @my-notion-go/web build`。
