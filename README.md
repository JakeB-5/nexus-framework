<p align="center">
  <h1 align="center">Nexus</h1>
  <p align="center"><strong>AI-Native Full-Stack TypeScript Application Platform</strong></p>
  <p align="center">
    A comprehensive, modular TypeScript framework for building production-grade server applications.<br/>
    20 packages &middot; zero external runtime dependencies &middot; ESM-only
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.7+-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/ESM-only-yellow" alt="ESM Only" />
  <img src="https://img.shields.io/badge/Dependencies-zero-brightgreen" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/License-MIT-purple" alt="License" />
  <img src="https://img.shields.io/badge/Packages-20-orange" alt="Packages" />
</p>

---

## Highlights

- **Zero external runtime dependencies** -- every package is built from scratch using only Node.js built-in modules
- **20 production-ready packages** covering DI, HTTP, routing, validation, ORM, auth, WebSocket, GraphQL, and more
- **Strict TypeScript from top to bottom** -- full type inference, no `any` leaks, decorator-based APIs
- **Modular by design** -- use only the packages you need; each one works standalone or together
- **AI-native architecture** -- clean, consistent APIs that are easy to reason about and generate code for
- **~52,000 lines of source code** with **~16,500 lines of tests** across the entire platform

---

## Quick Start

```bash
# Create a new project
mkdir my-app && cd my-app
pnpm init

# Install core packages
pnpm add @nexus/core @nexus/http @nexus/router @nexus/validator
```

```typescript
import { Module, Injectable, NexusApplication } from "@nexus/core";
import { HttpModule, HttpServer } from "@nexus/http";
import { RouterModule, Router } from "@nexus/router";
import { v } from "@nexus/validator";

// Define a validation schema
const CreateUserSchema = v.object({
  name: v.string().min(1).max(100),
  email: v.string().email(),
  age: v.number().int().positive().optional(),
});

// Create an injectable service
@Injectable()
class UserService {
  private users: Array<{ id: string; name: string; email: string }> = [];

  create(data: { name: string; email: string }) {
    const user = { id: crypto.randomUUID(), ...data };
    this.users.push(user);
    return user;
  }

  findAll() {
    return this.users;
  }
}

// Define your root module
@Module({
  imports: [
    HttpModule.register({ port: 3000 }),
    RouterModule,
  ],
  providers: [UserService],
})
class AppModule {}

// Bootstrap and start
const app = await NexusApplication.create(AppModule);

const server = app.resolve<HttpServer>(HttpServer);
const router = new Router();

const userService = app.resolve(UserService);

router.get("/users", (req, res) => {
  res.json(userService.findAll());
});

router.post("/users", async (req, res) => {
  const body = CreateUserSchema.parse(req.body);
  const user = userService.create(body);
  res.status(201).json(user);
});

server.use(router.handler());
await server.listen();
await app.start();

console.log("Server running on http://localhost:3000");
```

---

## Packages

| Package | Description | LOC |
|---------|-------------|----:|
| **@nexus/core** | Dependency injection container, module system, lifecycle hooks | 2,293 |
| **@nexus/config** | Type-safe configuration with validation, env vars, and dot-notation access | 909 |
| **@nexus/logger** | Structured logging with levels, transports, and child loggers | 763 |
| **@nexus/events** | Typed event emitter with async support and wildcard listeners | 572 |
| **@nexus/http** | High-performance HTTP server with middleware pipeline | 953 |
| **@nexus/router** | Type-safe routing with path params, guards, and decorators | 859 |
| **@nexus/ws** | WebSocket server with rooms, broadcasting, and typed events | 1,264 |
| **@nexus/security** | CORS, CSRF protection, rate limiting, and security headers | 1,051 |
| **@nexus/validator** | Runtime type validation with full TypeScript inference | 1,807 |
| **@nexus/orm** | SQL-first ORM with query builder, migrations, and seeds | 2,531 |
| **@nexus/cache** | Multi-backend caching with TTL and invalidation strategies | 804 |
| **@nexus/storage** | File storage abstraction for local and cloud backends | 781 |
| **@nexus/auth** | Authentication and authorization with JWT, sessions, and RBAC | 1,634 |
| **@nexus/queue** | Background job processing with retries and priorities | 1,127 |
| **@nexus/mailer** | Email sending with template support and SMTP transport | 1,339 |
| **@nexus/scheduler** | Cron-like job scheduling with timezone support | 980 |
| **@nexus/graphql** | GraphQL schema-first integration with resolver mapping | 4,033 |
| **@nexus/openapi** | OpenAPI 3.x specification auto-generation | 1,427 |
| **@nexus/testing** | Test utilities, mocking helpers, and integration test harness | 1,553 |
| **@nexus/cli** | CLI tool for scaffolding and code generation | 950 |
| | **Total** | **~27,600** |

> LOC counts are for source files only (excluding tests). With tests: ~52,000 lines total.

---

## Architecture

### Dependency Hierarchy

```
                          @nexus/cli
                             |
              +--------------+--------------+
              |              |              |
         @nexus/graphql  @nexus/openapi  @nexus/testing
              |              |              |
    +---------+--------+-----+-----+--------+---------+
    |         |        |           |        |         |
@nexus/auth  @nexus/queue  @nexus/mailer  @nexus/scheduler
    |         |        |           |
    +---------+--------+-----------+
              |
    +---------+---------+-----------+-----------+
    |         |         |           |           |
@nexus/http  @nexus/router  @nexus/ws  @nexus/security
    |         |         |           |
    +---------+---------+-----------+
              |
    +---------+---------+-----------+-----------+
    |         |         |           |           |
@nexus/validator  @nexus/orm  @nexus/cache  @nexus/storage
              |
    +---------+---------+-----------+
    |         |         |           |
@nexus/core  @nexus/config  @nexus/logger  @nexus/events
```

### Design Principles

- **Layer isolation** -- each layer depends only on layers below it
- **Interface-driven** -- packages communicate through well-defined contracts
- **No circular dependencies** -- enforced by the module system with topological sorting
- **Decorator metadata via WeakMaps** -- no `reflect-metadata` polyfill required

---

## Core Concepts

### Dependency Injection

Nexus provides a full-featured DI container with constructor injection, scopes, and lifecycle management.

```typescript
import {
  Container,
  Injectable,
  Inject,
  Optional,
  Module,
  Scope,
  NexusApplication,
  createToken,
} from "@nexus/core";

// Create injection tokens for interfaces
const DB_TOKEN = createToken<DatabaseService>("DatabaseService");
const LOGGER_TOKEN = createToken<Logger>("Logger");

// Mark classes as injectable with scope control
@Injectable({ scope: Scope.Singleton })
class DatabaseService {
  async query(sql: string) {
    // ...
  }
}

@Injectable({ scope: Scope.Transient })
class RequestLogger {
  log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

// Use @Inject for token-based injection, @Optional for optional deps
@Injectable()
class UserRepository {
  constructor(
    @Inject(DB_TOKEN) private db: DatabaseService,
    @Optional() @Inject(LOGGER_TOKEN) private logger?: Logger,
  ) {}

  async findAll() {
    this.logger?.log("Fetching all users");
    return this.db.query("SELECT * FROM users");
  }
}

// Organize with modules
@Module({
  imports: [],
  providers: [
    DatabaseService,
    UserRepository,
    { provide: DB_TOKEN, useClass: DatabaseService },
  ],
  exports: [UserRepository],
})
class UserModule {}

// Bootstrap the application
@Module({
  imports: [UserModule],
})
class AppModule {}

const app = await NexusApplication.create(AppModule);
const users = app.resolve(UserRepository);
await app.start();
```

**Container features:**
- Singleton, Transient, and Scoped lifetimes
- Circular dependency detection with clear error messages
- Child containers and scoped containers
- Auto-disposal of `Disposable` instances
- Factory and value providers
- Async resolution support

---

### HTTP Server & Routing

Build HTTP APIs with a composable middleware pipeline, type-safe routing, and decorator-based controllers.

```typescript
import { HttpServer, bodyParser, cookieParser, errorHandler } from "@nexus/http";
import { Router, RouteGroup, createGuard } from "@nexus/router";
import { cors, rateLimit, helmet } from "@nexus/security";

const server = new HttpServer({ port: 3000, trustProxy: true });

// Global middleware
server.use(
  cors({ origin: ["https://myapp.com"], credentials: true }),
  helmet(),
  rateLimit({ windowMs: 60_000, max: 100 }),
  bodyParser(),
  cookieParser(),
);

// Create a guard
const authGuard = createGuard(async (req) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token) return { allowed: false, reason: "No token" };
  return { allowed: true };
});

// Fluent route definitions
const router = new Router();

const api = new RouteGroup({ prefix: "/api/v1" });

api.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

api.group({ prefix: "/posts", guards: [authGuard] }, (posts) => {
  posts.get("/", async (req, res) => {
    const page = Number(req.query.page) || 1;
    // ... fetch posts
    res.json({ posts: [], page });
  });

  posts.post("/", async (req, res) => {
    // req.body is parsed by bodyParser middleware
    res.status(201).json({ id: 1, ...req.body });
  });

  posts.delete("/:id", async (req, res) => {
    const { id } = req.params;
    res.status(204).end();
  });
});

router.mount(api);
server.use(router.handler());
server.use(errorHandler());

await server.listen();
```

**Decorator-based controllers:**

```typescript
import { Controller, Get, Post, Delete, Param, Body, UseGuard } from "@nexus/router";

@Controller("/api/posts")
class PostController {
  constructor(private postService: PostService) {}

  @Get("/")
  async list() {
    return this.postService.findAll();
  }

  @Get("/:id")
  async getById(@Param("id") id: string) {
    return this.postService.findById(id);
  }

  @Post("/")
  @UseGuard(authGuard)
  async create(@Body() data: CreatePostDto) {
    return this.postService.create(data);
  }

  @Delete("/:id")
  @UseGuard(authGuard)
  async remove(@Param("id") id: string) {
    await this.postService.delete(id);
  }
}
```

---

### Validation

Runtime type validation with full TypeScript type inference, inspired by Zod's API design.

```typescript
import { v, type Infer } from "@nexus/validator";

// Primitive types with chainable constraints
const nameSchema = v.string().min(1).max(100).trim();
const ageSchema = v.number().int().min(0).max(150);
const emailSchema = v.string().email();

// Object schemas with full type inference
const UserSchema = v.object({
  name: nameSchema,
  email: emailSchema,
  age: ageSchema.optional(),
  role: v.enum(["admin", "user", "moderator"] as const),
  tags: v.array(v.string()).min(1).max(10),
  address: v.object({
    street: v.string(),
    city: v.string(),
    zip: v.string().regex(/^\d{5}$/),
  }).optional(),
});

// Infer the TypeScript type from the schema
type User = Infer<typeof UserSchema>;
// {
//   name: string;
//   email: string;
//   age?: number;
//   role: "admin" | "user" | "moderator";
//   tags: string[];
//   address?: { street: string; city: string; zip: string };
// }

// Parse with error throwing
const user = UserSchema.parse(inputData);

// Safe parse (no exceptions)
const result = UserSchema.safeParse(inputData);
if (result.success) {
  console.log(result.data); // typed as User
} else {
  console.log(result.errors); // ValidationIssue[]
}

// Advanced: unions, discriminated unions, intersections
const ShapeSchema = v.discriminatedUnion("type", [
  v.object({ type: v.literal("circle"), radius: v.number().positive() }),
  v.object({ type: v.literal("rect"), width: v.number(), height: v.number() }),
]);

// Lazy schemas for recursive types
type TreeNode = { value: string; children: TreeNode[] };
const TreeSchema: ReturnType<typeof v.object> = v.object({
  value: v.string(),
  children: v.array(v.lazy(() => TreeSchema)),
});
```

**Supported types:** `string`, `number`, `boolean`, `date`, `array`, `object`, `tuple`, `record`, `enum`, `nativeEnum`, `literal`, `union`, `intersection`, `discriminatedUnion`, `any`, `unknown`, `never`, `void`, `instanceof`, `lazy`, `promise`, `custom`

---

### ORM & Database

A SQL-first ORM with a fluent query builder, schema migrations, and seed data support.

```typescript
import {
  QueryBuilder,
  SchemaBuilder,
  Model,
  MigrationRunner,
  DatabaseConnection,
  raw,
} from "@nexus/orm";

// Fluent query builder
const users = new QueryBuilder()
  .select("id", "name", "email")
  .from("users")
  .where("active", "=", true)
  .where("age", ">=", 18)
  .orderBy("created_at", "DESC")
  .limit(20)
  .offset(0)
  .toSQL();
// SELECT id, name, email FROM users
// WHERE active = ? AND age >= ?
// ORDER BY created_at DESC LIMIT 20 OFFSET 0

// Joins and subqueries
const postsWithAuthors = new QueryBuilder()
  .select("posts.*", "users.name as author_name")
  .from("posts")
  .join("INNER", "users", "posts.author_id = users.id")
  .where("posts.published", "=", true)
  .groupBy("posts.id")
  .toSQL();

// Insert builder
const insert = new QueryBuilder()
  .into("users")
  .insert({ name: "Alice", email: "alice@example.com", role: "admin" })
  .toSQL();

// Schema builder for migrations
const schema = new SchemaBuilder();
schema.createTable("posts", (table) => {
  table.column("id").type("uuid").primaryKey().defaultTo(raw("gen_random_uuid()"));
  table.column("title").type("varchar").notNull();
  table.column("body").type("text").notNull();
  table.column("author_id").type("uuid").notNull().references("users", "id");
  table.column("published").type("boolean").defaultTo(false);
  table.column("created_at").type("timestamp").defaultTo(raw("CURRENT_TIMESTAMP"));
  table.index(["author_id"]);
  table.unique(["title", "author_id"]);
});

// Run migrations
const runner = new MigrationRunner(connection);
await runner.up(); // Apply pending migrations
await runner.down(); // Rollback last migration
```

**Supported dialects:** SQLite, PostgreSQL, MySQL

---

### Authentication

Full-featured auth with JWT (HMAC-based, no external deps), session management, RBAC, and password hashing.

```typescript
import {
  sign,
  verify,
  refresh,
  hash,
  verifyPassword,
  SessionManager,
  RBAC,
  JwtGuard,
  authenticate,
  authorize,
  requireRole,
} from "@nexus/auth";

// JWT token management
const token = await sign(
  { userId: "123", role: "admin" },
  "your-secret-key",
  { expiresIn: "1h", issuer: "my-app" },
);

const payload = await verify(token, "your-secret-key");
console.log(payload.userId); // "123"

const newToken = await refresh(token, "your-secret-key", {
  expiresIn: "1h",
});

// Password hashing (PBKDF2-based, no bcrypt needed)
const hashed = await hash("my-secure-password");
const isValid = await verifyPassword("my-secure-password", hashed);

// Session management
const sessions = new SessionManager({
  secret: "session-secret",
  maxAge: 86400_000, // 24 hours
});

// Role-Based Access Control
const rbac = new RBAC({
  roles: {
    admin: { permissions: ["users:read", "users:write", "posts:*"] },
    editor: { permissions: ["posts:read", "posts:write"] },
    viewer: { permissions: ["posts:read"] },
  },
  hierarchy: { admin: ["editor"], editor: ["viewer"] },
});

rbac.can("editor", "posts:write"); // true
rbac.can("viewer", "posts:write"); // false
rbac.can("admin", "posts:write");  // true (inherited from editor)

// Middleware composition
server.use(
  authenticate({ secret: "your-secret-key" }),
);

// Route-level authorization
router.post("/admin/users",
  authorize({ roles: ["admin"] }),
  async (req, res) => {
    // Only admins can reach here
  },
);
```

**Guards for route protection:**

```typescript
import { JwtGuard, SessionGuard, ApiKeyGuard, CompositeGuard } from "@nexus/auth";

// Use guards with the router
const jwtGuard = new JwtGuard({ secret: "your-secret" });
const apiKeyGuard = new ApiKeyGuard({ keys: ["key-1", "key-2"] });

// Composite: allow JWT OR API key
const authGuard = new CompositeGuard([jwtGuard, apiKeyGuard], { mode: "any" });
```

---

## Example Application

The `examples/todo-api` directory contains a complete Todo API built with Nexus packages, demonstrating:

- Application bootstrapping with `NexusApplication.create()`
- Module composition with `@Module` decorator
- HTTP server with middleware pipeline
- Route definitions with validation
- Dependency injection for services

```bash
cd examples/todo-api
pnpm install
pnpm dev
```

---

## Development

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9

### Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests without cache
pnpm test:ci

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Format code
pnpm format

# Run all packages in dev/watch mode
pnpm dev

# Release (build + changeset publish)
pnpm release
```

### Project Structure

```
nexus/
  packages/
    core/           # DI container, modules, lifecycle, hooks
    config/         # Configuration management
    logger/         # Structured logging
    events/         # Event emitter system
    http/           # HTTP server & middleware
    router/         # Routing & controllers
    ws/             # WebSocket server
    security/       # CORS, CSRF, rate limiting, headers
    validator/      # Schema validation
    orm/            # Query builder, migrations, models
    cache/          # Caching layer
    storage/        # File storage
    auth/           # JWT, sessions, RBAC, passwords
    queue/          # Job queue processing
    mailer/         # Email sending
    scheduler/      # Cron scheduling
    graphql/        # GraphQL integration
    openapi/        # OpenAPI spec generation
    testing/        # Test utilities
    cli/            # CLI scaffolding tool
  examples/
    todo-api/       # Example Todo REST API
```

---

## Design Philosophy

### AI-Native

Nexus is designed with AI-assisted development in mind. Every API follows consistent patterns -- if you learn one package, the rest feel familiar. Clean, predictable interfaces mean AI tools can reason about your code and generate correct implementations with minimal context.

### Zero Dependencies

Every package is built from scratch using only Node.js built-in modules (`node:http`, `node:crypto`, `node:fs`, etc.). This means:

- **No supply chain risk** -- no transitive dependencies to audit
- **No version conflicts** -- nothing can break except Node.js itself
- **Smaller deployments** -- no `node_modules` bloat from third-party packages
- **Full control** -- every line of code is yours to read, debug, and modify

### ESM-Only

Nexus is published as pure ECMAScript Modules. No CommonJS, no dual-package hazards, no `.mjs` extensions. This keeps the module graph clean and aligns with the direction of the Node.js ecosystem.

### Strict TypeScript

- `strict: true` across all packages
- No `any` type leaks in public APIs
- Full type inference (e.g., validator schemas infer TypeScript types automatically)
- Decorator metadata stored via `WeakMap` -- no `reflect-metadata` polyfill required

---

## License

MIT -- see [LICENSE](./LICENSE) for details.
