import { describe, it, expect } from "vitest";
import { sign } from "../src/jwt.js";
import { JwtGuard, ApiKeyGuard } from "../src/guards.js";
import { RBAC } from "../src/rbac.js";
import {
  authenticate,
  authorize,
  requireRole,
  optionalAuth,
  composeMiddleware,
  requireUser,
  getAuthContext,
  setAuthContext,
} from "../src/middleware.js";
import { AuthenticationError, AuthorizationError } from "../src/errors.js";
import type { AuthRequest, AuthResponse } from "../src/types.js";

const SECRET = "middleware-test-secret";

function makeReq(headers: Record<string, string> = {}): AuthRequest {
  return { headers };
}

function makeRes(): AuthResponse {
  return {
    setHeader: () => {},
  };
}

describe("authenticate middleware", () => {
  it("should set auth context on valid token", async () => {
    const guard = new JwtGuard(SECRET);
    const token = sign({ sub: "user1", roles: ["user"] }, SECRET);
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const mw = authenticate(guard);

    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    const ctx = getAuthContext(req);
    expect(ctx).toBeDefined();
    expect(ctx!.user!.id).toBe("user1");
  });

  it("should throw AuthenticationError on invalid token", async () => {
    const guard = new JwtGuard(SECRET);
    const req = makeReq({});
    const res = makeRes();
    const mw = authenticate(guard);

    await expect(mw(req, res, () => {})).rejects.toThrow(AuthenticationError);
  });
});

describe("optionalAuth middleware", () => {
  it("should continue without user when not authenticated", async () => {
    const guard = new JwtGuard(SECRET);
    const req = makeReq({});
    const res = makeRes();
    const mw = optionalAuth(guard);

    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(getAuthContext(req)).toBeUndefined();
  });

  it("should set user when authenticated", async () => {
    const guard = new JwtGuard(SECRET);
    const token = sign({ sub: "user1", roles: [] }, SECRET);
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const mw = optionalAuth(guard);

    await mw(req, res, () => {});
    expect(getAuthContext(req)!.user).toBeDefined();
  });
});

describe("authorize middleware", () => {
  const rbac = new RBAC({
    roles: {
      user: { name: "user", permissions: ["posts:read"] },
      admin: { name: "admin", permissions: ["posts:*"], inherits: ["user"] },
    },
  });

  it("should pass when user has permission", async () => {
    const req = makeReq({});
    const res = makeRes();
    setAuthContext(req, { user: { id: "u1", roles: ["admin"] } });

    const mw = authorize(rbac, "posts:write");
    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("should throw when user lacks permission", async () => {
    const req = makeReq({});
    const res = makeRes();
    setAuthContext(req, { user: { id: "u1", roles: ["user"] } });

    const mw = authorize(rbac, "posts:write");
    await expect(mw(req, res, () => {})).rejects.toThrow(AuthorizationError);
  });

  it("should throw when no user in context", async () => {
    const req = makeReq({});
    const res = makeRes();
    const mw = authorize(rbac, "posts:read");
    await expect(mw(req, res, () => {})).rejects.toThrow(AuthenticationError);
  });
});

describe("requireRole middleware", () => {
  it("should pass when user has required role", async () => {
    const req = makeReq({});
    const res = makeRes();
    setAuthContext(req, { user: { id: "u1", roles: ["admin"] } });

    const mw = requireRole("admin");
    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("should pass when user has any of required roles", async () => {
    const req = makeReq({});
    const res = makeRes();
    setAuthContext(req, { user: { id: "u1", roles: ["editor"] } });

    const mw = requireRole("admin", "editor");
    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("should throw when user lacks role", async () => {
    const req = makeReq({});
    const res = makeRes();
    setAuthContext(req, { user: { id: "u1", roles: ["user"] } });

    const mw = requireRole("admin");
    await expect(mw(req, res, () => {})).rejects.toThrow(AuthorizationError);
  });
});

describe("requireUser middleware", () => {
  it("should pass when user exists", async () => {
    const req = makeReq({});
    const res = makeRes();
    setAuthContext(req, { user: { id: "u1", roles: [] } });

    const mw = requireUser();
    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("should throw when no user", async () => {
    const req = makeReq({});
    const res = makeRes();
    const mw = requireUser();
    await expect(mw(req, res, () => {})).rejects.toThrow(AuthenticationError);
  });
});

describe("composeMiddleware", () => {
  it("should execute middlewares in order", async () => {
    const order: number[] = [];
    const mw1 = authenticate(
      new ApiKeyGuard({ key: { id: "u1", roles: ["admin"] } }),
    );
    const mw2 = requireRole("admin");

    const req = makeReq({ "x-api-key": "key" });
    const res = makeRes();
    const composed = composeMiddleware(mw1, mw2);

    let finalCalled = false;
    await composed(req, res, () => {
      finalCalled = true;
    });
    expect(finalCalled).toBe(true);
  });

  it("should stop on error in chain", async () => {
    const guard = new JwtGuard(SECRET);
    const mw1 = authenticate(guard); // will fail
    const mw2 = requireRole("admin");

    const req = makeReq({});
    const res = makeRes();
    const composed = composeMiddleware(mw1, mw2);

    await expect(composed(req, res, () => {})).rejects.toThrow(
      AuthenticationError,
    );
  });
});
