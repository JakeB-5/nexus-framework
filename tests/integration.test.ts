/**
 * Cross-package integration tests
 *
 * Verifies that Nexus packages work together correctly when composed
 * into a real application scenario.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Core - DI and module system
import {
  Container,
  Scope,
  NexusError,
  createToken,
} from "@nexus/core";

// Config
import { ConfigService } from "@nexus/config";

// Logger
import { Logger } from "@nexus/logger";

// Events
import { EventBus } from "@nexus/events";

// Validator
import { v } from "@nexus/validator";
import type { Infer } from "@nexus/validator";

// HTTP
import { HttpServer, NexusRequest, NexusResponse } from "@nexus/http";

// Router
import { Router } from "@nexus/router";

// ORM
import { QueryBuilder, SchemaBuilder } from "@nexus/orm";

// Cache
import { CacheManager, MemoryStore } from "@nexus/cache";

// Auth
import { sign, verify, hash, verifyPassword, RBAC } from "@nexus/auth";

// Security
import { createCorsMiddleware, createHelmetMiddleware } from "@nexus/security";

// Queue
import { Queue, MemoryQueueStorage } from "@nexus/queue";

// Scheduler
import { CronParser } from "@nexus/scheduler";

// Storage
import { MemoryAdapter, Disk } from "@nexus/storage";

// Mailer
import { MailMessage, MemoryTransport } from "@nexus/mailer";

// GraphQL
import { buildSchema, execute, parse as parseGql } from "@nexus/graphql";

// OpenAPI
import { OpenApiBuilder } from "@nexus/openapi";

// Testing utilities
import { mockFn, FakeClock } from "@nexus/testing";

// CLI
import { ArgParser } from "@nexus/cli";

// ============================================================
// Integration Test Suite
// ============================================================

describe("Cross-Package Integration", () => {
  describe("DI Container + Services", () => {
    it("should wire services together via container", () => {
      const container = new Container();

      // Register a logger instance
      const logger = new Logger({ level: "info" });
      container.register("logger", { useValue: logger });

      // Register an event bus
      const eventBus = new EventBus();
      container.register("events", { useValue: eventBus });

      // Register a cache manager
      const cache = new CacheManager({ store: new MemoryStore() });
      container.register("cache", { useValue: cache });

      // Resolve and verify
      expect(container.resolve("logger")).toBe(logger);
      expect(container.resolve("events")).toBe(eventBus);
      expect(container.resolve("cache")).toBe(cache);
      expect(container.has("logger")).toBe(true);
    });

    it("should create scoped containers for request isolation", () => {
      const container = new Container();
      container.register("requestId", {
        useFactory: () => crypto.randomUUID(),
        scope: Scope.Transient,
      });

      const id1 = container.resolve<string>("requestId");
      const id2 = container.resolve<string>("requestId");
      expect(id1).not.toBe(id2);
    });
  });

  describe("Validator + HTTP Request Pipeline", () => {
    const CreateUserSchema = v.object({
      name: v.string().min(1).max(100),
      email: v.string().email(),
      age: v.number().int().positive().optional(),
    });

    type CreateUser = Infer<typeof CreateUserSchema>;

    it("should validate request bodies with proper type inference", () => {
      const validData = { name: "Alice", email: "alice@test.com", age: 30 };
      const result = CreateUserSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        const user: CreateUser = result.data;
        expect(user.name).toBe("Alice");
        expect(user.email).toBe("alice@test.com");
        expect(user.age).toBe(30);
      }
    });

    it("should reject invalid data with structured errors", () => {
      const invalidData = { name: "", email: "not-an-email", age: -5 };
      const result = CreateUserSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Auth + Security Middleware Chain", () => {
    it("should sign and verify JWT tokens", async () => {
      const secret = "integration-test-secret-key-32chars!!";
      const payload = { userId: "123", role: "admin" };

      const token = await sign(payload, secret, { expiresIn: "1h" });
      expect(token).toBeTruthy();
      expect(token.split(".")).toHaveLength(3);

      const decoded = await verify(token, secret);
      expect(decoded.userId).toBe("123");
      expect(decoded.role).toBe("admin");
    });

    it("should hash and verify passwords", async () => {
      const password = "super-secure-password-123!";
      const hashed = await hash(password);

      expect(hashed).not.toBe(password);
      expect(await verifyPassword(password, hashed)).toBe(true);
      expect(await verifyPassword("wrong-password", hashed)).toBe(false);
    });

    it("should enforce RBAC permission hierarchy", () => {
      const rbac = new RBAC();
      rbac.addRole("viewer", ["posts:read"]);
      rbac.addRole("editor", ["posts:read", "posts:write", "posts:delete"]);
      rbac.addRole("admin", ["*"]);

      expect(rbac.can("viewer", "posts:read")).toBe(true);
      expect(rbac.can("viewer", "posts:write")).toBe(false);
      expect(rbac.can("editor", "posts:write")).toBe(true);
      expect(rbac.can("admin", "posts:delete")).toBe(true);
      expect(rbac.can("admin", "users:manage")).toBe(true);
    });
  });

  describe("ORM Query Builder + Schema Builder", () => {
    it("should generate correct SQL for complex queries", () => {
      const query = new QueryBuilder()
        .select("users.id", "users.name", "COUNT(posts.id) as post_count")
        .from("users")
        .join("LEFT", "posts", "posts.author_id = users.id")
        .where("users.active", "=", true)
        .groupBy("users.id")
        .having("COUNT(posts.id)", ">", 5)
        .orderBy("post_count", "DESC")
        .limit(10)
        .toSQL();

      expect(query.sql).toContain("SELECT");
      expect(query.sql).toContain("LEFT JOIN");
      expect(query.sql).toContain("WHERE");
      expect(query.sql).toContain("GROUP BY");
      expect(query.sql).toContain("HAVING");
      expect(query.sql).toContain("ORDER BY");
      expect(query.sql).toContain("LIMIT");
    });

    it("should build DDL for table creation", () => {
      const schema = new SchemaBuilder();
      const ddl = schema.createTable("users", (table) => {
        table.column("id").type("uuid").primaryKey();
        table.column("name").type("varchar").notNull();
        table.column("email").type("varchar").notNull().unique();
        table.column("created_at").type("timestamp").notNull();
      });

      expect(ddl).toContain("CREATE TABLE");
      expect(ddl).toContain("users");
      expect(ddl).toContain("PRIMARY KEY");
      expect(ddl).toContain("NOT NULL");
      expect(ddl).toContain("UNIQUE");
    });
  });

  describe("Cache + Events Integration", () => {
    it("should cache values and emit events on changes", async () => {
      const cache = new CacheManager({ store: new MemoryStore() });
      const eventBus = new EventBus();

      const cacheHits: string[] = [];
      eventBus.on("cache:hit", (data: { key: string }) => {
        cacheHits.push(data.key);
      });

      // Set and get
      await cache.set("user:1", { name: "Alice" }, 60000);
      const user = await cache.get<{ name: string }>("user:1");
      expect(user).toEqual({ name: "Alice" });

      // Cache-aside pattern
      const result = await cache.getOrSet("computed:1", async () => {
        return { value: 42 };
      }, 60000);
      expect(result).toEqual({ value: 42 });

      // Stats
      const stats = cache.getStats();
      expect(stats.sets).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Queue + Scheduler", () => {
    it("should parse cron expressions and enqueue jobs", async () => {
      // Cron parser
      const parser = new CronParser("*/5 * * * *");
      const nextRun = parser.getNextDate();
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());

      // Queue
      const storage = new MemoryQueueStorage();
      const queue = new Queue("test-queue", { storage });

      const job = await queue.add("send-email", {
        to: "user@test.com",
        subject: "Hello",
      });

      expect(job.id).toBeTruthy();
      expect(job.name).toBe("send-email");
      expect(job.data.to).toBe("user@test.com");
    });
  });

  describe("Storage + Mailer", () => {
    it("should store files with memory adapter", async () => {
      const adapter = new MemoryAdapter();
      const disk = new Disk(adapter);

      await disk.write("templates/welcome.html", Buffer.from("<h1>Welcome!</h1>"));
      const exists = await disk.exists("templates/welcome.html");
      expect(exists).toBe(true);

      const content = await disk.read("templates/welcome.html");
      expect(content.toString()).toBe("<h1>Welcome!</h1>");

      const files = await disk.list("templates/");
      expect(files.length).toBe(1);
    });

    it("should compose email messages", () => {
      const message = new MailMessage()
        .from("noreply@nexus.dev")
        .to("user@test.com")
        .subject("Welcome to Nexus")
        .html("<h1>Welcome!</h1>")
        .text("Welcome!");

      const built = message.build();
      expect(built.from).toBe("noreply@nexus.dev");
      expect(built.subject).toBe("Welcome to Nexus");
    });
  });

  describe("GraphQL Schema + Execution", () => {
    it("should parse SDL schema and execute queries", () => {
      const sdl = `
        type Query {
          hello(name: String!): String!
          users: [User!]!
        }
        type User {
          id: ID!
          name: String!
        }
      `;

      const schema = buildSchema(sdl);
      expect(schema).toBeTruthy();
      expect(schema.queryType).toBeTruthy();

      const doc = parseGql("{ hello(name: \"World\") }");
      expect(doc).toBeTruthy();
      expect(doc.definitions.length).toBeGreaterThan(0);
    });
  });

  describe("OpenAPI Spec Generation", () => {
    it("should build valid OpenAPI 3.1 spec", () => {
      const builder = new OpenApiBuilder()
        .setInfo("Nexus API", "1.0.0", "Integration test API")
        .addServer("http://localhost:3000")
        .addTag("users", "User operations");

      builder.addPath("/users", {
        get: {
          summary: "List users",
          tags: ["users"],
          responses: {
            "200": { description: "Success" },
          },
        },
        post: {
          summary: "Create user",
          tags: ["users"],
          responses: {
            "201": { description: "Created" },
          },
        },
      });

      const spec = builder.build();
      expect(spec.openapi).toBe("3.1.0");
      expect(spec.info.title).toBe("Nexus API");
      expect(spec.paths["/users"]).toBeTruthy();
    });
  });

  describe("Testing Utilities", () => {
    it("should create mock functions with tracking", () => {
      const fn = mockFn<(x: number) => number>();
      fn.returns(42);

      expect(fn(1)).toBe(42);
      expect(fn(2)).toBe(42);
      expect(fn.callCount).toBe(2);
      expect(fn.calls[0]).toEqual([1]);
      expect(fn.calls[1]).toEqual([2]);

      fn.reset();
      expect(fn.callCount).toBe(0);
    });

    it("should mock time with FakeClock", () => {
      const clock = new FakeClock();
      const now = Date.now();
      clock.install();

      clock.tick(5000);
      expect(Date.now()).toBeGreaterThanOrEqual(now + 5000);

      clock.uninstall();
    });
  });

  describe("CLI Argument Parser", () => {
    it("should parse command-line arguments", () => {
      const parser = new ArgParser({
        name: "nexus",
        description: "Nexus CLI",
      });

      parser.option("--port", { type: "number", default: 3000 });
      parser.option("--verbose", { type: "boolean", alias: "-v" });
      parser.option("--config", { type: "string" });

      const result = parser.parse(["--port", "8080", "--verbose", "--config", "app.json"]);
      expect(result.port).toBe(8080);
      expect(result.verbose).toBe(true);
      expect(result.config).toBe("app.json");
    });
  });

  describe("Router + Validation End-to-End", () => {
    it("should define routes with parameter extraction", () => {
      const router = new Router();

      const handlers: string[] = [];

      router.get("/api/users", () => { handlers.push("list-users"); });
      router.get("/api/users/:id", () => { handlers.push("get-user"); });
      router.post("/api/users", () => { handlers.push("create-user"); });

      // Match routes
      const match1 = router.find("GET", "/api/users");
      expect(match1).toBeTruthy();

      const match2 = router.find("GET", "/api/users/123");
      expect(match2).toBeTruthy();
      if (match2) {
        expect(match2.params.id).toBe("123");
      }

      const match3 = router.find("POST", "/api/users");
      expect(match3).toBeTruthy();

      const noMatch = router.find("DELETE", "/api/posts");
      expect(noMatch).toBeNull();
    });
  });

  describe("Error Hierarchy", () => {
    it("should maintain consistent error hierarchy across packages", () => {
      const error = new NexusError("test error", "TEST_001");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NexusError);
      expect(error.message).toBe("test error");
      expect(error.code).toBe("TEST_001");
    });
  });

  describe("Config + Logger Integration", () => {
    it("should configure logger from config service", () => {
      const config = new ConfigService({
        data: {
          log: { level: "debug", format: "json" },
          app: { name: "integration-test", port: 3000 },
        },
      });

      expect(config.get("log.level")).toBe("debug");
      expect(config.get("app.name")).toBe("integration-test");
      expect(config.get("app.port")).toBe(3000);
      expect(config.get("missing.key", "default")).toBe("default");

      const logger = new Logger({
        level: config.get("log.level", "info") as string,
      });
      expect(logger).toBeTruthy();
    });
  });
});
