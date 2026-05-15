---
name: "my-notion-visual-alignment"
description: "Aligns my-notion-go Web UI with the original My-Notion style. Invoke when building or changing apps/web UI, layouts, pages, assets, or interactions."
---

# My-Notion Visual Alignment

Use this skill whenever changing `my-notion-go/apps/web` UI, especially pages, layouts, navigation, document tree, document detail, auth screens, empty states, icons, spacing, colors, and static assets.

The goal is not to invent a new visual system. The Go rewrite should visually match the original My-Notion product as much as possible while using the new React + Vite + Go backend stack.

## Hard Rule

Before implementing or changing Web UI in `my-notion-go/apps/web`, inspect the original My-Notion Web implementation under:

```txt
/Users/bytedance/Desktop/project/My-Notion/apps/web
```

Do not rely only on memory or generic Notion-like assumptions when an original component, page, screenshot, or asset exists.

## Primary References

Use these original Web files as visual and interaction references:

```txt
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/Navigation.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/Item.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/document-list.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/Navbar.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/Title.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/Banner.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/_components/trash-box.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/(routes)/documents/page.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/(main)/(routes)/documents/[documentId]/page.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/components/Toolbar.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/components/Cover.tsx
/Users/bytedance/Desktop/project/My-Notion/apps/web/src/app/[locale]/globals.css
```

Use these original public assets when useful:

```txt
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/logo.svg
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/logo-dark.svg
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/documents.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/documents-dark.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/empty.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/empty-dark.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/reading.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/reading-dark.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/error.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/error-dark.png
/Users/bytedance/Desktop/project/My-Notion/apps/web/public/screenshots/
```

## Visual Baseline

Match these original My-Notion characteristics:

1. App typography: system font stack from original `globals.css`, including Apple / Segoe / Helvetica / PingFang / Noto / Microsoft YaHei fallbacks.
2. Main layout: Notion-like full-height workspace, left sidebar at about `240px`, document canvas on the right.
3. Sidebar background: original `bg-secondary` feel, close to light neutral gray rather than blue-tinted dashboard cards.
4. Sidebar rows: compact `min-h-[30px]`, text-sm, muted foreground, hover background close to `primary/5` or neutral hover.
5. Document tree indentation: nested rows increase left padding by about `12px` per level.
6. Row icons: use simple document emoji or Lucide-style monochrome icons; avoid heavy colorful illustrations in navigation rows.
7. Action visibility: plus, more, collapse, and row action buttons should be subtle and often appear on hover.
8. Document detail: wide but centered content column, plain title-first editing surface, minimal card chrome.
9. Empty states: use original static images when appropriate, especially `documents.png` / `empty.png`.
10. Color style: mostly neutral black/gray/white with sparse accent usage; avoid bright blue gradients for workspace pages.
11. Border radius: subtle small radius for rows/buttons; large rounded cards are acceptable for auth/marketing but not the main document workspace.

## Implementation Rules For my-notion-go

The new project uses Vite + React, not Next.js. Adapt patterns, do not copy framework-specific code blindly.

1. Use `react-router-dom` for routes.
2. Use `zustand` for durable UI state such as sidebar collapsed state.
3. Use `ahooks` for common lifecycle/callback/request helpers when applicable.
4. Use `@tanstack/react-query` for server state and cache around Document APIs.
5. Keep `packages/api-client` as the API boundary; UI components should not duplicate fetch details when an API client helper exists.
6. Keep CSS class names and tokens aligned with original style even if Tailwind is not yet installed.
7. Prefer reusing/copying static assets from the original `apps/web/public` into `my-notion-go/apps/web/public` when the page needs original empty, document, logo, or error visuals.
8. Do not introduce a new design language such as blue SaaS dashboard cards for the document workspace.
9. Keep visual components split by responsibility so style alignment stays reviewable: sidebar, tree row, navbar, modal, empty state, and detail surface should not all live in one file.
10. Add concise Chinese comments to business UI components explaining which original My-Notion pattern they mirror.
11. Any user-facing UI copy added for visual alignment must still go through `apps/web/src/i18n/resources.ts` and `useTranslation()`; do not hard-code Chinese or English copy in JSX.

## Document MVP Checklist

When implementing frontend Document MVP, match these original concepts:

1. Dashboard should become a workspace shell, not a centered profile card.
2. Left sidebar should include current user area, search/settings placeholders if needed, and a Document section.
3. Document tree rows should visually follow original `Item.tsx`: compact height, muted text, hover row, chevron for expandable documents, plus action for child creation when supported.
4. New root document button should follow original sidebar create action style, not a large primary CTA.
5. Clicking a document should navigate to `/documents/:id`.
6. Document detail page should start with a simple title surface and metadata/actions, not a generic admin detail card.
7. Title editing should feel inline and low-friction, similar to the original document title behavior.
8. Archive action should be accessible but visually secondary, usually under a subtle action area or row menu.
9. Empty document page should use original `documents.png` or `empty.png` style if no document is selected.
10. Preserve responsive behavior: on narrow screens, sidebar may collapse or stack, but desktop style is the primary target.

## Visual Verification Workflow

For UI work, use this workflow:

1. Inspect relevant original source files and public assets.
2. Inspect current `my-notion-go/apps/web` implementation.
3. Implement the smallest UI diff that moves the rewrite closer to the original.
4. Run `pnpm typecheck` and `pnpm build:web`.
5. If a browser/dev server is available, open the Vite page and compare against original screenshots or source layout.

## Playwright / Browser Guidance

Browser automation can help with final visual verification, but it is not a substitute for reading the original source and assets.

Use Playwright or browser tooling when:

1. The dev server can run locally.
2. A visual/layout regression is hard to judge from code alone.
3. You need to inspect real rendered spacing, overflow, responsive behavior, or screenshots.

Do not install Playwright or browser agents by default for every UI change. Install or add them only when the task needs rendered-page evidence and the user agrees, because it adds dependency and setup cost.

If visual verification is needed without adding dependencies, first use Vite dev server plus manual browser preview if available.

## Anti-Patterns

Avoid:

1. Replacing original Notion-like workspace UI with generic SaaS dashboard cards.
2. Using large gradients, saturated accent backgrounds, or marketing-style panels in the document workspace.
3. Creating new icon/image assets when original `public/` assets already fit.
4. Implementing document tree rows without nested indentation or compact hover interactions.
5. Treating the Go rewrite as a greenfield visual redesign.
6. Copying Next.js / Convex code directly into Vite code without adapting routing, data fetching, and API boundaries.

## Required Handoff

When finishing a UI change governed by this skill, summarize:

1. Which original My-Notion files or assets were referenced.
2. Which visual patterns were matched.
3. Any deliberate deviations and why.
4. Verification commands and results.
