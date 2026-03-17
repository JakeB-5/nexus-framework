# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nexus** is an AI-Native Full-Stack TypeScript Application Platform — a modular monorepo containing 20 packages that together provide everything needed to build production-grade TypeScript server applications.

Key differentiator: every Nexus application can automatically expose AI-agent-consumable interfaces (MCP/OpenAPI) alongside traditional REST/GraphQL APIs.

## Architecture

Monorepo managed with **pnpm workspaces** + **Turborepo**. All packages are ESM-only, targeting Node.js 20+.

### Dependency Hierarchy (build order matters)

```
Layer 0 (no deps):     core, validator
Layer 1 (core only):   config, logger, events
Layer 2 (Layer 0+1):   http, cache, mailer, storage
Layer 3 (Layer 0-2):   router, orm, auth, queue, ws, security, scheduler
Layer 4 (Layer 0-3):   graphql, openapi, testing, cli
```

### Package Responsibilities

- **@nexus/core** — DI container (`Container`), module system (`@Module`, `@Injectable`), lifecycle hooks (`OnInit`, `OnDestroy`)
- **@nexus/http** — HTTP server wrapping `node:http`, middleware pipeline, request/response abstractions
- **@nexus/router** — Trie-based path matching, type-safe route params, route guards
- **@nexus/orm** — SQL query builder, schema definitions, migrations runner, connection pooling
- **@nexus/validator** — Chainable schema builders with TypeScript type inference (like Zod)
- **@nexus/auth** — JWT signing/verification, session management, RBAC with permissions
- **@nexus/queue** — In-memory + persistent job queues, retries, dead letter, priorities
- **@nexus/cache** — TTL-based caching with memory/LRU backends, cache-aside pattern
- **@nexus/ws** — WebSocket server on top of @nexus/http, rooms, typed event broadcasting
- **@nexus/events** — Typed EventBus, wildcard subscriptions, async event handling
- **@nexus/logger** — Structured JSON logging, log levels, pluggable transports
- **@nexus/config** — Layered config from env/files/defaults, type-safe access, validation
- **@nexus/security** — CORS, CSRF tokens, rate limiter (token bucket), security headers
- **@nexus/mailer** — Email composition with templates, SMTP transport abstraction
- **@nexus/storage** — File read/write/delete/list with local filesystem and S3-like adapters
- **@nexus/scheduler** — Cron expression parser, scheduled job runner, overlap prevention
- **@nexus/graphql** — Schema-first GraphQL, resolver mapping, subscription support
- **@nexus/openapi** — Auto-generate OpenAPI 3.1 specs from router metadata
- **@nexus/testing** — `createTestApp()`, request helpers, mock providers, in-memory overrides
- **@nexus/cli** — `nexus new`, `nexus generate`, dev server with watch mode

## Common Commands

```bash
# Install all dependencies
pnpm install

# Build all packages (respects dependency order via turbo)
pnpm build

# Run all tests
pnpm test

# Run tests for a single package
pnpm --filter @nexus/core test

# Run a single test file
pnpm --filter @nexus/core exec vitest run --no-cache __tests__/container.test.ts

# Type-check all packages
pnpm typecheck

# Type-check a single package
pnpm --filter @nexus/http typecheck

# Clean all build artifacts
pnpm clean

# Build + test a single package and its deps
turbo run test --filter=@nexus/router...
```

## Code Conventions

- **ESM-only**: All imports use `.js` extension (`import { Foo } from "./foo.js"`), even for TypeScript sources. This is required by NodeNext module resolution.
- **No default exports**: Every module uses named exports only.
- **Barrel exports**: Each package's `src/index.ts` re-exports the public API. Internal modules are not exported.
- **DI pattern**: Services are decorated with `@Injectable()` and resolved via `Container`. Constructor injection is the primary pattern.
- **Error classes**: Each package defines its own error hierarchy extending `NexusError` from core.
- **Test naming**: Test files mirror source structure — `src/container.ts` → `__tests__/container.test.ts`.
- **No external runtime deps**: Packages rely only on Node.js built-in modules and other @nexus packages. Dev dependencies (vitest, typescript) are workspace-root only.

## Testing

- Framework: **Vitest** with `globals: true`
- Each package has its own `vitest.config.ts` and `__tests__/` directory
- Always run with `--no-cache` flag to ensure tests actually execute
- Workspace-level test orchestration via `vitest.workspace.ts`

## TypeScript Configuration

- **Base config**: `tsconfig.base.json` — strict mode, ES2022 target, NodeNext modules
- Each package extends base and sets its own `outDir`/`rootDir`
- Build outputs go to `packages/<name>/dist/`
