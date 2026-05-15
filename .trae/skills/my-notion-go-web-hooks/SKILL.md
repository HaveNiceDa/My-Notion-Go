---
name: "my-notion-go-web-hooks"
description: "Guides My-Notion Go Web hook usage. Invoke when editing React Web code, requests, callbacks, timers, forms, routes, or global state."
---

# My-Notion Go Web Hooks

Use this skill when working on `my-notion-go/apps/web`.

## Core Rule

Prefer mature third-party hooks and framework primitives over hand-written hook logic.

Default choices:

1. Route state and navigation: `react-router-dom`.
2. Global client state: `zustand`.
3. Server state and cache: `@tanstack/react-query`.
4. Form state and validation: `react-hook-form` + `zod`.
5. Request lifecycle and common React hooks: `ahooks`.

## ahooks Rule

Use `ahooks` before writing custom hook logic for common UI behavior.

Preferred mappings:

1. Request loading/error/lifecycle: `useRequest`.
2. Stable event callbacks: `useMemoizedFn`.
3. Mount-only effects: `useMount`.
4. Unmount cleanup: `useUnmount`.
5. Debounce: `useDebounce`, `useDebounceFn`.
6. Throttle: `useThrottle`, `useThrottleFn`.
7. Timers and intervals: `useInterval`, `useTimeout`.
8. Previous value tracking: `usePrevious`.
9. Local storage state: `useLocalStorageState`, unless security boundaries require an explicit storage wrapper.
10. Boolean toggles: `useBoolean`.

Do not hand-write `useEffect` + `useState` request loading flags when `useRequest` fits.

Do not use React `useCallback` for event callback stability unless `useMemoizedFn` is unsuitable.

Do not hand-write debounce, throttle, interval, timeout, previous-value, or mount-only hooks.

## Auth Guidance

For Auth UI:

1. Keep token storage behind `features/auth/authStorage.ts`.
2. Keep global auth state in `features/auth/authStore.ts` with Zustand.
3. Use React Router route guards for public-only and protected pages.
4. Use `ahooks/useRequest` for login, register, logout, refresh, and other request lifecycle needs.
5. Use `ahooks/useMount` for initial session restoration from persisted tokens.
6. Use `ahooks/useMemoizedFn` for stable submit and click handlers.

## Comments

Add succinct Chinese learning-oriented comments for important Web state, routing, and hook choices.

Required comment targets:

1. Zustand store types and exported stores: explain the store's overall responsibility and why the state is global.
2. Important store fields/actions: explain what owns the state and which components should consume it.
3. Route guard components: explain what access rule they enforce.
4. Request hooks: explain which request lifecycle `useRequest` owns.
5. Non-obvious hook choices: explain why a third-party hook is used instead of hand-written logic.
6. Business React components: explain what the component owns and what it delegates to child components.
7. Feature containers: explain which API/query/mutation lifecycle the container coordinates.

For global state, prefer a block comment above the state type or store:

```ts
// AuthState is the single source of truth for the Web auth session.
// It centralizes current user, access token, refresh token, and session recovery,
// so pages do not each maintain their own inconsistent login state.
type AuthState = {}
```

For route guards, comment the rule rather than the JSX:

```tsx
// ProtectedRoute blocks unauthenticated users from private pages and redirects them to login.
function ProtectedRoute() {}
```

For important hook choices, document:

1. Why a third-party hook is used.
2. Which lifecycle or state concern it owns.
3. What should not be duplicated manually in the component.

Avoid comments that restate a prop assignment, obvious variable name, or a single obvious line.

## Component File Responsibility

Prefer single-responsibility component files in `apps/web`.

Rules:

1. Keep routing shells, auth dialogs, marketing home, workspace layout, sidebar, tree item, detail page, and empty states in separate files.
2. A file should usually export one primary component.
3. If a component owns server state or mutations, keep it as a container and move presentational children into separate files.
4. Move shared feature types into `types.ts`.
5. Move query keys and API cache keys into `queryKeys.ts`.
6. Keep utility functions such as error-message mapping in focused helper files.

Avoid:

1. A single file containing route definitions, modal forms, landing page, protected workspace, and loading screen at the same time.
2. A single document workspace file containing sidebar, document tree recursion, navbar, detail editor, empty state, and skeleton UI.
3. Adding new child components at the bottom of an already large file just because it is convenient.

## Internationalization Rule

All user-facing frontend copy in `apps/web` must support i18n.

Use the current stack:

1. Runtime i18n: `i18next` + `react-i18next`.
2. Resources: `apps/web/src/i18n/resources.ts`.
3. Initialization: `apps/web/src/i18n/index.ts`.
4. Component access: `useTranslation()` and `t(...)`.
5. Language switch UI: `features/i18n/LanguageToggle.tsx`.

Rules:

1. Do not hard-code user-facing Chinese or English strings directly in React components.
2. Add new copy to both `zh.translation` and `en.translation` in `resources.ts`.
3. Keep translation keys grouped by feature namespace, such as `common`, `marketing`, `auth`, `workspace`, `documents`, and future `editor`.
4. Use `t("namespace.key")` in components.
5. Use interpolation for dynamic copy, for example `t("documents.lastEdited", { time })`.
6. Localize accessibility copy too, including `aria-label`, `title`, image `alt`, placeholders, loading text, empty states, and validation errors.
7. For Zod schemas, create schema factory functions that receive `t`, so validation errors follow the current language.
8. For date/time text, format with the current `i18n.language` locale when displayed to users.
9. If a copy is product data from the backend, such as a document title typed by the user, do not translate it.
10. If a fallback default is generated by the client, such as an untitled new document, get it from i18n resources.

Avoid:

1. Mixing English and Chinese literals in JSX.
2. Putting translation logic inside `packages/api-client`.
3. Creating separate translation objects inside feature components.
4. Adding only one language and leaving the other language missing.

## Verification

After changing Web hook, routing, form, or state code, run:

```bash
pnpm typecheck
pnpm build:web
```

Also check IDE diagnostics for recently edited files.
