import { describe, it, expect } from "vitest";
import { sign } from "../src/jwt.js";
import {
  JwtGuard,
  SessionGuard,
  ApiKeyGuard,
  CompositeGuard,
} from "../src/guards.js";
import { SessionManager } from "../src/session.js";
import { MemorySessionStore } from "../src/session-store.js";
import type { AuthRequest } from "../src/types.js";

const SECRET = "test-secret-for-guards";

function makeRequest(headers: Record<string, string>): AuthRequest {
  return { headers };
}

describe("JwtGuard", () => {
  it("should authenticate valid Bearer token", async () => {
    const guard = new JwtGuard(SECRET);
    const token = sign({ sub: "user1", roles: ["admin"] }, SECRET);
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe("user1");
  });

  it("should fail without authorization header", async () => {
    const guard = new JwtGuard(SECRET);
    const req = makeRequest({});
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain("No Bearer token");
  });

  it("should fail with invalid token", async () => {
    const guard = new JwtGuard(SECRET);
    const req = makeRequest({ authorization: "Bearer invalid.token.here" });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
  });

  it("should fail with non-Bearer auth", async () => {
    const guard = new JwtGuard(SECRET);
    const req = makeRequest({ authorization: "Basic abc123" });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
  });

  it("should use custom user extractor", async () => {
    const guard = new JwtGuard(SECRET, {}, (payload) => ({
      id: payload["sub"] as string,
      roles: ["custom"],
    }));
    const token = sign({ sub: "user1" }, SECRET);
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const result = await guard.authenticate(req);
    expect(result.user!.roles).toEqual(["custom"]);
  });
});

describe("SessionGuard", () => {
  it("should authenticate valid session cookie", async () => {
    const store = new MemorySessionStore(0);
    const manager = new SessionManager(
      { cookieName: "sid", ttl: 60000 },
      store,
    );
    const session = await manager.create({ userId: "u1", roles: ["user"] });

    const guard = new SessionGuard(manager);
    const req = makeRequest({ cookie: `sid=${session.id}` });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(true);
    expect(result.user).toBeDefined();
    store.dispose();
  });

  it("should fail without cookie header", async () => {
    const store = new MemorySessionStore(0);
    const manager = new SessionManager({ cookieName: "sid" }, store);
    const guard = new SessionGuard(manager);
    const req = makeRequest({});
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
    store.dispose();
  });

  it("should fail with invalid session id", async () => {
    const store = new MemorySessionStore(0);
    const manager = new SessionManager({ cookieName: "sid" }, store);
    const guard = new SessionGuard(manager);
    const req = makeRequest({ cookie: "sid=invalid-session" });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
    store.dispose();
  });
});

describe("ApiKeyGuard", () => {
  it("should authenticate valid API key", async () => {
    const guard = new ApiKeyGuard({
      "key-123": { id: "service1", roles: ["service"] },
    });
    const req = makeRequest({ "x-api-key": "key-123" });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(true);
    expect(result.user!.id).toBe("service1");
  });

  it("should fail with invalid API key", async () => {
    const guard = new ApiKeyGuard({
      "key-123": { id: "service1", roles: ["service"] },
    });
    const req = makeRequest({ "x-api-key": "wrong-key" });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
  });

  it("should fail without API key header", async () => {
    const guard = new ApiKeyGuard({});
    const req = makeRequest({});
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(false);
  });

  it("should use custom header name", async () => {
    const guard = new ApiKeyGuard(
      { "key-123": { id: "s1", roles: [] } },
      "authorization",
    );
    const req = makeRequest({ authorization: "key-123" });
    const result = await guard.authenticate(req);
    expect(result.authenticated).toBe(true);
  });

  it("should add and remove keys dynamically", async () => {
    const guard = new ApiKeyGuard({});
    guard.addKey("new-key", { id: "s1", roles: [] });
    let result = await guard.authenticate(
      makeRequest({ "x-api-key": "new-key" }),
    );
    expect(result.authenticated).toBe(true);

    guard.removeKey("new-key");
    result = await guard.authenticate(
      makeRequest({ "x-api-key": "new-key" }),
    );
    expect(result.authenticated).toBe(false);
  });
});

describe("CompositeGuard", () => {
  it("should try guards in order and return first success", async () => {
    const jwtGuard = new JwtGuard(SECRET);
    const apiGuard = new ApiKeyGuard({
      "key-1": { id: "s1", roles: ["service"] },
    });
    const composite = new CompositeGuard([jwtGuard, apiGuard]);

    const req = makeRequest({ "x-api-key": "key-1" });
    const result = await composite.authenticate(req);
    expect(result.authenticated).toBe(true);
    expect(result.user!.id).toBe("s1");
  });

  it("should fail if all guards fail", async () => {
    const jwtGuard = new JwtGuard(SECRET);
    const apiGuard = new ApiKeyGuard({});
    const composite = new CompositeGuard([jwtGuard, apiGuard]);

    const req = makeRequest({});
    const result = await composite.authenticate(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain("All guards failed");
  });

  it("should throw if constructed with empty guards", () => {
    expect(() => new CompositeGuard([])).toThrow();
  });
});
