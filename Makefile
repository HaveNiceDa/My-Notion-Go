.PHONY: dev dev-web dev-api migrate-api build build-web build-api test-go fmt-go

dev:
	pnpm dev

dev-web:
	pnpm dev:web

dev-api:
	pnpm dev:api

migrate-api:
	pnpm migrate:api

build: build-web build-api

build-web:
	pnpm build:web

build-api:
	pnpm build:api

test-go:
	pnpm test:go

fmt-go:
	pnpm format:go
