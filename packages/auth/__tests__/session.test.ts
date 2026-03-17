import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../src/session.js";
import { MemorySessionStore } from "../src/session-store.js";

describe("SessionManager", () => {
  let manager: SessionManager;
  let store: MemorySessionStore;

  beforeEach(() => {
    store = new MemorySessionStore(0); // disable auto cleanup
    manager = new SessionManager({ ttl: 60_000, slidingExpiration: false }, store);
  });

  afterEach(() => {
    store.dispose();
  });

  it("should create a session", async () => {
    const session = await manager.create({ userId: "u1" });
    expect(session.id).toBeTruthy();
    expect(session.data.userId).toBe("u1");
    expect(session.createdAt).toBeTypeOf("number");
    expect(session.expiresAt).toBeGreaterThan(session.createdAt);
  });

  it("should retrieve a session", async () => {
    const session = await manager.create({ userId: "u1" });
    const retrieved = await manager.get(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.data.userId).toBe("u1");
  });

  it("should return undefined for unknown session", async () => {
    const result = await manager.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("should update session data", async () => {
    const session = await manager.create({ userId: "u1" });
    const updated = await manager.update(session.id, { role: "admin" });
    expect(updated).toBeDefined();
    expect(updated!.data.userId).toBe("u1");
    expect(updated!.data.role).toBe("admin");
  });

  it("should return undefined when updating unknown session", async () => {
    const result = await manager.update("nonexistent", { x: 1 });
    expect(result).toBeUndefined();
  });

  it("should destroy a session", async () => {
    const session = await manager.create({});
    expect(await manager.exists(session.id)).toBe(true);
    const destroyed = await manager.destroy(session.id);
    expect(destroyed).toBe(true);
    expect(await manager.exists(session.id)).toBe(false);
  });

  it("should return false when destroying unknown session", async () => {
    expect(await manager.destroy("nonexistent")).toBe(false);
  });

  it("should check session existence", async () => {
    const session = await manager.create({});
    expect(await manager.exists(session.id)).toBe(true);
    expect(await manager.exists("nope")).toBe(false);
  });
});

describe("SessionManager with sliding expiration", () => {
  let manager: SessionManager;
  let store: MemorySessionStore;

  beforeEach(() => {
    store = new MemorySessionStore(0);
    manager = new SessionManager(
      { ttl: 60_000, slidingExpiration: true },
      store,
    );
  });

  afterEach(() => {
    store.dispose();
  });

  it("should extend session on get with sliding expiration", async () => {
    const session = await manager.create({});
    const originalExpiry = session.expiresAt;

    // Small delay to ensure time passes
    await new Promise((resolve) => setTimeout(resolve, 10));

    const retrieved = await manager.get(session.id);
    expect(retrieved!.expiresAt).toBeGreaterThanOrEqual(originalExpiry);
  });
});

describe("SessionManager cookie handling", () => {
  let manager: SessionManager;
  let store: MemorySessionStore;

  beforeEach(() => {
    store = new MemorySessionStore(0);
    manager = new SessionManager({ cookieName: "sid" }, store);
  });

  afterEach(() => {
    store.dispose();
  });

  it("should format set-cookie header", () => {
    const cookie = manager.formatSetCookie("abc123");
    expect(cookie).toContain("sid=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });

  it("should format clear-cookie header", () => {
    const cookie = manager.formatClearCookie();
    expect(cookie).toContain("sid=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("should parse session id from cookie header", () => {
    const id = manager.parseCookieHeader("other=x; sid=abc123; foo=bar");
    expect(id).toBe("abc123");
  });

  it("should return undefined if cookie not found", () => {
    const id = manager.parseCookieHeader("other=x; foo=bar");
    expect(id).toBeUndefined();
  });

  it("should return cookie name", () => {
    expect(manager.getCookieName()).toBe("sid");
  });
});

describe("MemorySessionStore", () => {
  let store: MemorySessionStore;

  beforeEach(() => {
    store = new MemorySessionStore(0);
  });

  afterEach(() => {
    store.dispose();
  });

  it("should handle expired sessions on get", async () => {
    await store.set("s1", {
      id: "s1",
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() - 1000,
    });
    expect(await store.get("s1")).toBeUndefined();
  });

  it("should cleanup expired sessions", async () => {
    await store.set("s1", {
      id: "s1",
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() - 1000,
    });
    await store.set("s2", {
      id: "s2",
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });

    const removed = store.cleanup();
    expect(removed).toBe(1);
    expect(await store.size()).toBe(1);
  });

  it("should touch a session", async () => {
    const future = Date.now() + 60000;
    await store.set("s1", {
      id: "s1",
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: future,
    });

    const newExpiry = Date.now() + 120000;
    expect(await store.touch("s1", newExpiry)).toBe(true);
    const session = await store.get("s1");
    expect(session!.expiresAt).toBe(newExpiry);
  });

  it("should return false when touching nonexistent session", async () => {
    expect(await store.touch("nope", Date.now() + 60000)).toBe(false);
  });

  it("should clear all sessions", async () => {
    await store.set("s1", {
      id: "s1",
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });
    await store.clear();
    expect(await store.size()).toBe(0);
  });
});
