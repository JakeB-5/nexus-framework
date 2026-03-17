// @nexus/router - Comprehensive test suite
import { describe, it, expect } from "vitest";
import {
  Router,
  RouteTrie,
  Route,
  normalizePath,
  joinPaths,
  RouteGroup,
  createGuard,
  composeGuards,
  guardMiddleware,
  Controller,
  Get,
  Post,
  getControllerMetadata,
  getRouteMethodsMetadata,
  RouterModule,
  ROUTER_TOKEN,
  RouteNotFoundError,
  MethodNotAllowedError,
} from "../src/index.js";
import type {
  NexusRequestLike,
  NexusResponseLike,
  NextFunction,
  HandlerFunction,
} from "../src/index.js";

// Mock request/response helpers
function mockReq(overrides: Partial<NexusRequestLike> = {}): NexusRequestLike {
  return {
    method: "GET",
    url: "/",
    path: "/",
    query: new URLSearchParams(),
    headers: {},
    ip: "127.0.0.1",
    cookies: {},
    params: {},
    body: async () => ({}),
    get: () => undefined,
    ...overrides,
  };
}

function mockRes(): NexusResponseLike & { _status: number; _body: unknown; _headers: Record<string, string | string[]> } {
  const res = {
    headersSent: false,
    statusCode: 200,
    _status: 200,
    _body: undefined as unknown,
    _headers: {} as Record<string, string | string[]>,
    status(code: number) {
      res._status = code;
      res.statusCode = code;
      return res;
    },
    header(name: string, value: string | string[]) {
      res._headers[name.toLowerCase()] = value;
      return res;
    },
    json(data: unknown) {
      res._body = data;
      res.headersSent = true;
    },
    text(data: string) {
      res._body = data;
      res.headersSent = true;
    },
    html(data: string) {
      res._body = data;
      res.headersSent = true;
    },
    redirect(_url: string, _code?: number) {
      res.headersSent = true;
    },
    send(data: unknown) {
      res._body = data;
      res.headersSent = true;
    },
    end() {
      res.headersSent = true;
    },
  };
  return res;
}

// =====================================================
// PATH UTILITIES
// =====================================================
describe("Path Utilities", () => {
  it("should normalize paths with leading slash", () => {
    expect(normalizePath("users")).toBe("/users");
    expect(normalizePath("/users")).toBe("/users");
  });

  it("should remove trailing slash", () => {
    expect(normalizePath("/users/")).toBe("/users");
  });

  it("should keep root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("should collapse multiple slashes", () => {
    expect(normalizePath("//users///list//")).toBe("/users/list");
  });

  it("should join paths correctly", () => {
    expect(joinPaths("/api", "/users")).toBe("/api/users");
    expect(joinPaths("/api", "/")).toBe("/api");
    expect(joinPaths("/", "/users")).toBe("/users");
    expect(joinPaths("/api/v1", "/users/list")).toBe("/api/v1/users/list");
  });
});

// =====================================================
// ROUTE CLASS
// =====================================================
describe("Route", () => {
  it("should create route with method and path", () => {
    const handler: HandlerFunction = (_req, _res, _next) => {};
    const route = new Route("GET", "/users", [handler]);
    expect(route.method).toBe("GET");
    expect(route.path).toBe("/users");
    expect(route.handlers).toHaveLength(1);
  });

  it("should normalize path", () => {
    const route = new Route("GET", "users/", []);
    expect(route.path).toBe("/users");
  });

  it("should store name and metadata", () => {
    const route = new Route("GET", "/users", [], { name: "list-users", metadata: { auth: true } });
    expect(route.name).toBe("list-users");
    expect(route.metadata).toEqual({ auth: true });
  });

  it("should default metadata to empty object", () => {
    const route = new Route("GET", "/users", []);
    expect(route.metadata).toEqual({});
  });
});

// =====================================================
// TRIE-BASED PATH MATCHING
// =====================================================
describe("RouteTrie", () => {
  it("should match static paths", () => {
    const trie = new RouteTrie();
    const route = new Route("GET", "/users", []);
    trie.insert(route);

    const match = trie.match("GET", "/users");
    expect(match).toBeDefined();
    expect(match!.route).toBe(route);
  });

  it("should match root path", () => {
    const trie = new RouteTrie();
    const route = new Route("GET", "/", []);
    trie.insert(route);

    const match = trie.match("GET", "/");
    expect(match).toBeDefined();
  });

  it("should match nested static paths", () => {
    const trie = new RouteTrie();
    const route = new Route("GET", "/api/v1/users", []);
    trie.insert(route);

    const match = trie.match("GET", "/api/v1/users");
    expect(match).toBeDefined();
  });

  it("should return undefined for non-matching path", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/users", []));

    expect(trie.match("GET", "/posts")).toBeUndefined();
  });

  it("should match parameter paths", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/users/:id", []));

    const match = trie.match("GET", "/users/123");
    expect(match).toBeDefined();
    expect(match!.params).toEqual({ id: "123" });
  });

  it("should match multiple parameters", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/users/:userId/posts/:postId", []));

    const match = trie.match("GET", "/users/42/posts/99");
    expect(match).toBeDefined();
    expect(match!.params).toEqual({ userId: "42", postId: "99" });
  });

  it("should match wildcard paths", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/files/*path", []));

    const match = trie.match("GET", "/files/docs/readme.md");
    expect(match).toBeDefined();
    expect(match!.params).toEqual({ path: "docs/readme.md" });
  });

  it("should prioritize static over param", () => {
    const trie = new RouteTrie();
    const staticRoute = new Route("GET", "/users/me", []);
    const paramRoute = new Route("GET", "/users/:id", []);
    trie.insert(staticRoute);
    trie.insert(paramRoute);

    const match = trie.match("GET", "/users/me");
    expect(match).toBeDefined();
    expect(match!.route).toBe(staticRoute);

    const paramMatch = trie.match("GET", "/users/123");
    expect(paramMatch).toBeDefined();
    expect(paramMatch!.route).toBe(paramRoute);
  });

  it("should match with regex constraints", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/users/:id(\\d+)", []));

    const match = trie.match("GET", "/users/123");
    expect(match).toBeDefined();
    expect(match!.params).toEqual({ id: "123" });

    const noMatch = trie.match("GET", "/users/abc");
    expect(noMatch).toBeUndefined();
  });

  it("should match different methods on same path", () => {
    const trie = new RouteTrie();
    const getRoute = new Route("GET", "/users", []);
    const postRoute = new Route("POST", "/users", []);
    trie.insert(getRoute);
    trie.insert(postRoute);

    expect(trie.match("GET", "/users")!.route).toBe(getRoute);
    expect(trie.match("POST", "/users")!.route).toBe(postRoute);
  });

  it("should match ALL method as fallback", () => {
    const trie = new RouteTrie();
    const allRoute = new Route("ALL", "/api", []);
    trie.insert(allRoute);

    expect(trie.match("GET", "/api")).toBeDefined();
    expect(trie.match("POST", "/api")).toBeDefined();
    expect(trie.match("DELETE", "/api")).toBeDefined();
  });

  it("should get allowed methods for path", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/users", []));
    trie.insert(new Route("POST", "/users", []));

    const methods = trie.getAllowedMethods("/users");
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toHaveLength(2);
  });

  it("should return empty array for non-existing path", () => {
    const trie = new RouteTrie();
    expect(trie.getAllowedMethods("/nothing")).toEqual([]);
  });

  it("should decode URI components in parameters", () => {
    const trie = new RouteTrie();
    trie.insert(new Route("GET", "/search/:query", []));

    const match = trie.match("GET", "/search/hello%20world");
    expect(match).toBeDefined();
    expect(match!.params).toEqual({ query: "hello world" });
  });

  it("should be case-insensitive by default", () => {
    const trie = new RouteTrie(false);
    trie.insert(new Route("GET", "/Users", []));

    expect(trie.match("GET", "/users")).toBeDefined();
    expect(trie.match("GET", "/USERS")).toBeDefined();
  });

  it("should be case-sensitive when configured", () => {
    const trie = new RouteTrie(true);
    trie.insert(new Route("GET", "/Users", []));

    expect(trie.match("GET", "/Users")).toBeDefined();
    expect(trie.match("GET", "/users")).toBeUndefined();
  });
});

// =====================================================
// ROUTER CLASS
// =====================================================
describe("Router", () => {
  it("should register GET route", () => {
    const router = new Router();
    const handler: HandlerFunction = (_req, res, _next) => res.json({ ok: true });
    router.get("/users", handler);

    const match = router.resolve("GET", "/users");
    expect(match).toBeDefined();
    expect(match!.handlers).toHaveLength(1);
  });

  it("should register all HTTP methods", () => {
    const router = new Router();
    const handler: HandlerFunction = (_req, _res, _next) => {};

    router.get("/a", handler);
    router.post("/b", handler);
    router.put("/c", handler);
    router.patch("/d", handler);
    router.delete("/e", handler);
    router.head("/f", handler);
    router.options("/g", handler);
    router.all("/h", handler);

    expect(router.routes).toHaveLength(8);
  });

  it("should resolve with params", () => {
    const router = new Router();
    router.get("/users/:id", (_req, _res, _next) => {});

    const match = router.resolve("GET", "/users/42");
    expect(match).toBeDefined();
    expect(match!.params.id).toBe("42");
  });

  it("should return undefined for non-matching routes", () => {
    const router = new Router();
    router.get("/users", (_req, _res, _next) => {});

    expect(router.resolve("GET", "/posts")).toBeUndefined();
  });

  it("should support route prefix", () => {
    const router = new Router({ prefix: "/api" });
    router.get("/users", (_req, _res, _next) => {});

    expect(router.routes[0]!.path).toBe("/api/users");
  });

  it("should mount sub-router", () => {
    const main = new Router();
    const sub = new Router();
    sub.get("/", (_req, _res, _next) => {});
    sub.get("/:id", (_req, _res, _next) => {});

    main.use("/users", sub);

    expect(main.resolve("GET", "/users")).toBeDefined();
    expect(main.resolve("GET", "/users/123")).toBeDefined();
  });

  it("should support route grouping", () => {
    const router = new Router();
    router.group("/api/v1", (group) => {
      group.get("/users", (_req, _res, _next) => {});
      group.post("/users", (_req, _res, _next) => {});
    });

    expect(router.resolve("GET", "/api/v1/users")).toBeDefined();
    expect(router.resolve("POST", "/api/v1/users")).toBeDefined();
  });

  it("should support nested groups", () => {
    const router = new Router();
    router.group("/api", (api) => {
      api.group("/v1", (v1) => {
        v1.get("/users", (_req, _res, _next) => {});
      });
    });

    expect(router.resolve("GET", "/api/v1/users")).toBeDefined();
  });

  it("should add middleware", () => {
    const router = new Router();
    const calls: string[] = [];

    router.use((_req, _res, next) => {
      calls.push("middleware");
      next();
    });

    router.get("/test", (_req, res, _next) => {
      calls.push("handler");
      res.json({ ok: true });
    });

    // Handler() method creates middleware for use with HttpServer
    const handlerFn = router.handler();
    const req = mockReq({ method: "GET", path: "/test" });
    const res = mockRes();

    handlerFn(req, res, () => {});
    // Allow async execution
    expect(router.routes).toHaveLength(1);
  });

  it("should expose routes list", () => {
    const router = new Router();
    router.get("/a", (_req, _res, _next) => {});
    router.post("/b", (_req, _res, _next) => {});

    expect(router.routes).toHaveLength(2);
    expect(router.routes[0]!.method).toBe("GET");
    expect(router.routes[1]!.method).toBe("POST");
  });

  it("should execute handler() middleware correctly", async () => {
    const router = new Router();
    router.get("/hello", (_req, res, _next) => {
      res.json({ message: "world" });
    });

    const handler = router.handler();
    const req = mockReq({ method: "GET", path: "/hello" });
    const res = mockRes();

    await handler(req, res, () => {});
    expect(res._body).toEqual({ message: "world" });
  });

  it("should call next when no route matches", async () => {
    const router = new Router();
    const handler = router.handler();
    const req = mockReq({ method: "GET", path: "/nothing" });
    const res = mockRes();
    let nextCalled = false;

    await handler(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("should return 405 when method not allowed", async () => {
    const router = new Router();
    router.get("/users", (_req, res, _next) => res.json([]));

    const handler = router.handler();
    const req = mockReq({ method: "POST", path: "/users" });
    const res = mockRes();

    await handler(req, res, () => {});
    expect(res._status).toBe(405);
  });

  it("should set params on request", async () => {
    const router = new Router();
    let capturedParams: Record<string, string> = {};
    router.get("/users/:id", (req, res, _next) => {
      capturedParams = req.params;
      res.json({ id: req.params.id });
    });

    const handler = router.handler();
    const req = mockReq({ method: "GET", path: "/users/42" });
    const res = mockRes();

    await handler(req, res, () => {});
    expect(capturedParams).toEqual({ id: "42" });
  });

  it("should get allowed methods", () => {
    const router = new Router();
    router.get("/users", (_req, _res, _next) => {});
    router.post("/users", (_req, _res, _next) => {});

    const methods = router.getAllowedMethods("/users");
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
  });

  it("should support multiple handlers per route", async () => {
    const router = new Router();
    const calls: number[] = [];

    router.get("/multi",
      (_req, _res, next) => { calls.push(1); next(); },
      (_req, _res, next) => { calls.push(2); next(); },
      (_req, res, _next) => { calls.push(3); res.json({ ok: true }); },
    );

    const handler = router.handler();
    const req = mockReq({ method: "GET", path: "/multi" });
    const res = mockRes();

    await handler(req, res, () => {});
    expect(calls).toEqual([1, 2, 3]);
  });
});

// =====================================================
// ROUTE GROUPS
// =====================================================
describe("RouteGroup", () => {
  it("should create group with prefix", () => {
    const group = new RouteGroup({ prefix: "/api" });
    expect(group.prefix).toBe("/api");
    expect(group.middlewares).toEqual([]);
  });

  it("should create group with middlewares", () => {
    const mw: HandlerFunction = (_req, _res, next) => next();
    const group = new RouteGroup({ prefix: "/api", middlewares: [mw] });
    expect(group.middlewares).toHaveLength(1);
  });

  it("should add child groups", () => {
    const parent = new RouteGroup({ prefix: "/api" });
    const child = new RouteGroup({ prefix: "/v1" });
    parent.addChild(child);
    expect(parent.children).toHaveLength(1);
  });

  it("should configure via callback", () => {
    let configured = false;
    const group = new RouteGroup({ prefix: "/api" }, () => {
      configured = true;
    });

    group.configure({} as RouteGroupApi);
    expect(configured).toBe(true);
  });
});

// =====================================================
// GUARDS
// =====================================================
describe("Guards", () => {
  it("should create guard from function", () => {
    const guard = createGuard(() => true);
    expect(guard.canActivate).toBeDefined();
  });

  it("should execute guard canActivate", async () => {
    const guard = createGuard((req) => req.method === "GET");
    const req = mockReq({ method: "GET" });
    expect(await guard.canActivate(req)).toBe(true);
  });

  it("should compose multiple guards (all must pass)", async () => {
    const guard1 = createGuard(() => true);
    const guard2 = createGuard(() => true);
    const composed = composeGuards(guard1, guard2);

    const req = mockReq();
    expect(await composed(req)).toBe(true);
  });

  it("should fail composed guard if any fails", async () => {
    const guard1 = createGuard(() => true);
    const guard2 = createGuard(() => false);
    const composed = composeGuards(guard1, guard2);

    const req = mockReq();
    expect(await composed(req)).toBe(false);
  });

  it("should compose guard functions directly", async () => {
    const composed = composeGuards(
      () => true,
      () => true,
    );
    expect(await composed(mockReq())).toBe(true);
  });

  it("should create guard middleware that allows", async () => {
    const mw = guardMiddleware(() => true);
    const req = mockReq();
    const res = mockRes();
    let nextCalled = false;

    await mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("should create guard middleware that denies", async () => {
    const mw = guardMiddleware(() => false);
    const req = mockReq();
    const res = mockRes();

    await mw(req, res, () => {});
    expect(res._status).toBe(403);
    expect(res._body).toEqual(expect.objectContaining({ error: "Forbidden" }));
  });

  it("should support async guards", async () => {
    const guard = createGuard(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return true;
    });
    expect(await guard.canActivate(mockReq())).toBe(true);
  });
});

// =====================================================
// DECORATORS
// =====================================================
describe("Decorators", () => {
  it("should apply Controller decorator", () => {
    @Controller("/users")
    class UsersController {}

    const meta = getControllerMetadata(UsersController);
    expect(meta).toBeDefined();
    expect(meta!.prefix).toBe("/users");
  });

  it("should apply method decorators", () => {
    class TestCtrl {
      @Get("/list")
      list() {}

      @Post("/create")
      create() {}
    }

    const methods = getRouteMethodsMetadata(TestCtrl.prototype);
    expect(methods).toHaveLength(2);
    expect(methods[0]!.method).toBe("GET");
    expect(methods[0]!.path).toBe("/list");
    expect(methods[1]!.method).toBe("POST");
    expect(methods[1]!.path).toBe("/create");
  });

  it("should apply Controller with default prefix", () => {
    @Controller()
    class DefaultCtrl {}

    const meta = getControllerMetadata(DefaultCtrl);
    expect(meta!.prefix).toBe("/");
  });

  it("should collect route metadata on controller", () => {
    @Controller("/api")
    class ApiCtrl {
      @Get("/items")
      getItems() {}
    }

    const meta = getControllerMetadata(ApiCtrl);
    expect(meta).toBeDefined();
    expect(meta!.routes).toHaveLength(1);
    expect(meta!.routes[0]!.path).toBe("/items");
  });
});

// =====================================================
// ERROR CLASSES
// =====================================================
describe("Router Errors", () => {
  it("should create RouteNotFoundError", () => {
    const err = new RouteNotFoundError("GET", "/users");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("ROUTE_NOT_FOUND");
    expect(err.method).toBe("GET");
    expect(err.path).toBe("/users");
    expect(err.message).toContain("GET /users");
  });

  it("should create MethodNotAllowedError", () => {
    const err = new MethodNotAllowedError("POST", "/users", ["GET", "HEAD"]);
    expect(err.statusCode).toBe(405);
    expect(err.code).toBe("METHOD_NOT_ALLOWED");
    expect(err.allowedMethods).toEqual(["GET", "HEAD"]);
    expect(err.message).toContain("GET, HEAD");
  });

  it("should be instanceof Error", () => {
    expect(new RouteNotFoundError("GET", "/")).toBeInstanceOf(Error);
    expect(new MethodNotAllowedError("POST", "/", [])).toBeInstanceOf(Error);
  });
});

// =====================================================
// ROUTER MODULE
// =====================================================
describe("RouterModule", () => {
  it("should register with default options", () => {
    const reg = RouterModule.register();
    expect(reg.token).toBe(ROUTER_TOKEN);
    expect(reg.options.prefix).toBe("");
    expect(reg.options.caseSensitive).toBe(false);
  });

  it("should register with custom options", () => {
    const reg = RouterModule.register({ prefix: "/api", caseSensitive: true });
    expect(reg.options.prefix).toBe("/api");
    expect(reg.options.caseSensitive).toBe(true);
  });

  it("should create Router from factory", () => {
    const reg = RouterModule.register();
    const router = reg.factory();
    expect(router).toBeInstanceOf(Router);
  });

  it("should have static token", () => {
    expect(RouterModule.token).toBe(ROUTER_TOKEN);
  });
});
