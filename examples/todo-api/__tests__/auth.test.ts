/**
 * Authentication Tests
 *
 * Tests for user registration, login, and JWT authentication.
 * In @nexus/testing, you'd use the test client:
 *
 *   const app = await createTestApp(AuthModule);
 *   const res = await app.post('/auth/register').send({ ... });
 *   expect(res.status).toBe(201);
 *
 * Here we test the services and auth utilities directly,
 * plus integration tests via the HTTP handler.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import { initDatabase, resetDatabase } from "../src/database/connection.js";
import { handleRequest } from "../src/app.js";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
} from "../src/middleware/auth.js";
import { userService } from "../src/user/user.service.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      void handleRequest(req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const responseBody = text ? JSON.parse(text) : {};
  return { status: res.status, body: responseBody };
}

// ---------------------------------------------------------------------------
// Unit tests: Password hashing
// ---------------------------------------------------------------------------

describe("Password Hashing", () => {
  it("should hash a password and produce a salt", async () => {
    const result = await hashPassword("mypassword123");

    expect(result.hash).toBeDefined();
    expect(result.salt).toBeDefined();
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.salt.length).toBeGreaterThan(0);
  });

  it("should produce different hashes for the same password (different salts)", async () => {
    const result1 = await hashPassword("samepassword");
    const result2 = await hashPassword("samepassword");

    expect(result1.hash).not.toBe(result2.hash);
    expect(result1.salt).not.toBe(result2.salt);
  });

  it("should verify a correct password", async () => {
    const password = "correctpassword";
    const { hash, salt } = await hashPassword(password);

    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const { hash, salt } = await hashPassword("original");

    const isValid = await verifyPassword("wrong", hash, salt);
    expect(isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: JWT tokens
// ---------------------------------------------------------------------------

describe("JWT Tokens", () => {
  it("should create and verify a valid token", () => {
    const payload = { sub: "user-123", email: "test@example.com", role: "user" as const };
    const token = createToken(payload);

    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);

    const decoded = verifyToken(token);
    expect(decoded.sub).toBe("user-123");
    expect(decoded.email).toBe("test@example.com");
    expect(decoded.role).toBe("user");
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it("should reject a malformed token", () => {
    expect(() => verifyToken("not.a.valid.token")).toThrow();
  });

  it("should reject a token with invalid signature", () => {
    const token = createToken({ sub: "user-1", email: "a@b.com", role: "user" as const });
    // Tamper with the signature
    const parts = token.split(".");
    parts[2] = "invalidsignature";
    const tampered = parts.join(".");

    expect(() => verifyToken(tampered)).toThrow("Invalid token signature");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: UserService
// ---------------------------------------------------------------------------

describe("UserService", () => {
  beforeEach(() => {
    resetDatabase();
    initDatabase();
  });

  it("should register a new user", async () => {
    const result = await userService.register({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    });

    expect(result.user.email).toBe("test@example.com");
    expect(result.user.name).toBe("Test User");
    expect(result.user.role).toBe("user");
    expect(result.token).toBeDefined();
    expect(result.expiresIn).toBeGreaterThan(0);
    // Password should NOT be in the response
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("should reject duplicate email registration", async () => {
    await userService.register({
      email: "dupe@example.com",
      password: "password123",
      name: "First User",
    });

    await expect(
      userService.register({
        email: "dupe@example.com",
        password: "password456",
        name: "Second User",
      }),
    ).rejects.toThrow("already exists");
  });

  it("should login with valid credentials", async () => {
    await userService.register({
      email: "login@example.com",
      password: "password123",
      name: "Login User",
    });

    const result = await userService.login({
      email: "login@example.com",
      password: "password123",
    });

    expect(result.user.email).toBe("login@example.com");
    expect(result.token).toBeDefined();
  });

  it("should reject login with wrong password", async () => {
    await userService.register({
      email: "wrong@example.com",
      password: "password123",
      name: "Wrong User",
    });

    await expect(
      userService.login({
        email: "wrong@example.com",
        password: "wrongpassword",
      }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("should reject login for non-existent user", async () => {
    await expect(
      userService.login({
        email: "nonexistent@example.com",
        password: "password123",
      }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("should get user profile by ID", async () => {
    const { user } = await userService.register({
      email: "profile@example.com",
      password: "password123",
      name: "Profile User",
    });

    const profile = userService.getProfile(user.id);
    expect(profile.email).toBe("profile@example.com");
    expect(profile.name).toBe("Profile User");
  });

  it("should normalize email to lowercase", async () => {
    const result = await userService.register({
      email: "UPPER@EXAMPLE.COM",
      password: "password123",
      name: "Upper User",
    });

    expect(result.user.email).toBe("upper@example.com");
  });
});

// ---------------------------------------------------------------------------
// Integration tests: Auth API endpoints
// ---------------------------------------------------------------------------

describe("Auth API", () => {
  beforeEach(async () => {
    resetDatabase();
    initDatabase();
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  describe("POST /auth/register", () => {
    it("should register a new user and return token", async () => {
      const res = await request("POST", "/auth/register", {
        email: "new@example.com",
        password: "password123",
        name: "New User",
      });

      expect(res.status).toBe(201);
      const data = res.body.data as Record<string, unknown>;
      expect(data.token).toBeDefined();
      const user = data.user as Record<string, unknown>;
      expect(user.email).toBe("new@example.com");
      expect(user.name).toBe("New User");
    });

    it("should return 422 for missing fields", async () => {
      const res = await request("POST", "/auth/register", {
        email: "incomplete@example.com",
      });

      expect(res.status).toBe(422);
    });

    it("should return 422 for invalid email", async () => {
      const res = await request("POST", "/auth/register", {
        email: "not-an-email",
        password: "password123",
        name: "Bad Email",
      });

      expect(res.status).toBe(422);
    });

    it("should return 422 for short password", async () => {
      const res = await request("POST", "/auth/register", {
        email: "short@example.com",
        password: "123",
        name: "Short Pass",
      });

      expect(res.status).toBe(422);
    });

    it("should return 409 for duplicate email", async () => {
      await request("POST", "/auth/register", {
        email: "dupe@example.com",
        password: "password123",
        name: "First",
      });

      const res = await request("POST", "/auth/register", {
        email: "dupe@example.com",
        password: "password456",
        name: "Second",
      });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request("POST", "/auth/register", {
        email: "auth@example.com",
        password: "password123",
        name: "Auth User",
      });
    });

    it("should login with valid credentials", async () => {
      const res = await request("POST", "/auth/login", {
        email: "auth@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.token).toBeDefined();
    });

    it("should return 401 for wrong password", async () => {
      const res = await request("POST", "/auth/login", {
        email: "auth@example.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
    });

    it("should return 401 for non-existent user", async () => {
      const res = await request("POST", "/auth/login", {
        email: "ghost@example.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/me", () => {
    it("should return user profile with valid token", async () => {
      const registerRes = await request("POST", "/auth/register", {
        email: "me@example.com",
        password: "password123",
        name: "Me User",
      });

      const registerData = registerRes.body.data as Record<string, unknown>;
      const token = registerData.token as string;

      const res = await request("GET", "/auth/me", undefined, {
        Authorization: `Bearer ${token}`,
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.email).toBe("me@example.com");
    });

    it("should return 401 without token", async () => {
      const res = await request("GET", "/auth/me");

      expect(res.status).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const res = await request("GET", "/auth/me", undefined, {
        Authorization: "Bearer invalid.token.here",
      });

      expect(res.status).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test: Health check
// ---------------------------------------------------------------------------

describe("Health Check", () => {
  beforeEach(async () => {
    resetDatabase();
    initDatabase();
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  it("GET /health should return status ok", async () => {
    const res = await request("GET", "/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });
});
