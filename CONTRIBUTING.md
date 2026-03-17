# Contributing to Nexus

Thank you for your interest in contributing to Nexus!

## Development Setup

```bash
git clone https://github.com/JakeB-5/nexus-framework.git
cd nexus-framework
pnpm install
pnpm build
pnpm test
```

## Project Structure

This is a monorepo managed with pnpm workspaces and Turborepo. Each package lives in `packages/<name>/` with:
- `src/` - Source code
- `__tests__/` - Test files
- `src/index.ts` - Public API barrel export

## Code Style

- **ESM-only**: Use `.js` extensions in imports (`import { Foo } from "./foo.js"`)
- **Named exports only**: No default exports
- **Strict TypeScript**: No `any` types in public APIs
- **Node.js built-ins**: Use `node:` prefix (`import { createHash } from "node:crypto"`)
- **Zero external deps**: Packages must not add external runtime dependencies

## Making Changes

1. Create a branch from `main`
2. Make your changes in the relevant package(s)
3. Write or update tests for your changes
4. Ensure all tests pass: `pnpm test`
5. Ensure type checking passes: `pnpm typecheck`
6. Submit a pull request

## Testing

- Each package uses Vitest with `globals: true`
- Tests go in `__tests__/*.test.ts`
- Run a single package's tests: `pnpm --filter @nexus/core test`
- Run all tests: `pnpm test`

## Adding a New Package

1. Create the directory structure in `packages/<name>/`
2. Add `package.json`, `tsconfig.json`, `vitest.config.ts`
3. Follow the patterns established by existing packages
4. Export the public API from `src/index.ts`
5. Write comprehensive tests

## Commit Messages

Follow conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for maintenance tasks
- `docs:` for documentation changes
- `test:` for test additions/changes
