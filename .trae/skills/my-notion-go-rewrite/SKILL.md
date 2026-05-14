---
name: "my-notion-go-rewrite"
description: "Guides the My-Notion Go rewrite. Invoke when working on my-notion-go progress, backend iterations, architecture, or key implementation changes."
---

# My-Notion Go Rewrite

Use this skill when working on the `my-notion-go` rewrite project.

## Project Context

`my-notion-go` is the Go Edition rewrite of My-Notion.

Core goals:

1. Build a standalone React + Go + PostgreSQL full-stack project.
2. Keep the project independent from the original Convex / Next.js / Expo implementation.
3. Prefer a modular monolith backend before introducing distributed systems.
4. Use PostgreSQL + GORM as the main persistence layer.
5. Use SSE before WebSocket for streaming and real-time updates.
6. Introduce Redis, RabbitMQ, Qdrant, and advanced RAG only after Auth, Document, Editor, and AI basics are stable.

## Progress Rule

Every meaningful iteration must write progress into `progress/`.

Progress files must:

1. Use `YYYYMMDD-HHMMSS.md` naming.
2. Summarize the iteration goal.
3. List completed changes.
4. Record verification commands and results.
5. Record known gaps or risks.
6. End with next-step suggestions.

Do not put short-term execution progress into `docs/`.

Use `docs/` only for long-term architecture, design, roadmap, or API planning documents.

## Comment Rule

When adding or changing important code, include succinct learning-oriented comments for important concepts.

Add comments for:

1. Public structs and functions.
2. Cross-layer boundaries such as handler, service, repository, middleware, model, DTO, and config.
3. Security-sensitive logic such as password hashing, token signing, refresh token storage, authentication, authorization, and user context.
4. Database decisions such as JSONB storage, soft delete, indexes, transactions, and migrations.
5. Frontend global state such as Zustand stores, route guards, token storage, request hooks, and form schemas.
6. Non-obvious control flow or trade-offs.

For frontend global state, comment the overall responsibility of the state object or store, not just individual fields:

```ts
// AuthState is the single source of truth for the Web auth session.
// It keeps user identity, token state, session recovery, and logout in one place.
type AuthState = {}
```

Avoid comments that merely restate a single obvious line.

Good comment:

```go
// UserDTO is the API response model. It avoids returning internal fields such as password_hash.
type UserDTO struct {}
```

Bad comment:

```go
// Assigns user.ID to ID.
ID: user.ID,
```

## Backend Iteration Rule

For backend features, prefer this structure:

1. `model` for database mapping.
2. `repository` for database reads/writes.
3. `service` for business rules.
4. `handler` for HTTP request/response mapping.
5. `middleware` for cross-cutting HTTP concerns.
6. `response` for shared response format.
7. `docs/openapi.yaml` for API contract updates when endpoints change.

Keep `cmd/api/main.go` focused on dependency wiring and route registration.

## Verification Rule

After substantive backend changes, run:

```bash
gofmt -w ./services/api
go test ./services/api/...
pnpm build:api
```

Also check diagnostics for recently edited files.

If database behavior changes, verify with real PostgreSQL when possible:

```bash
docker compose up -d postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/my_notion_go?sslmode=disable pnpm migrate:api
```

## Current Phase Guidance

Current priority sequence:

1. Auth MVP.
2. Frontend Auth pages and token storage.
3. Document CRUD.
4. Editor JSONB save and autosave.
5. AI Chat with SSE.
6. Redis / RabbitMQ / Qdrant / RAG.

Do not jump to advanced infrastructure before the core product path is stable.
