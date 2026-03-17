// @nexus/testing - Comprehensive test suite

import {
  // Mocks
  MockFn,
  mockFn,
  createMock,
  spy,
  // Test App
  TestApp,
  createTestApp,
  // Test Client
  TestClient,
  createTestClient,
  // Fixtures & Factories
  useFixture,
  loadFixture,
  teardownFixture,
  teardownAllFixtures,
  clearFixtures,
  defineFactory,
  Factory,
  sequence,
  numericSequence,
  // Matchers
  toBeValidResponse,
  toHaveHeader,
  toMatchSchema,
  toContainEntry,
  toBeWithinRange,
  toSatisfy,
  // Clock
  FakeClock,
  useFakeTimers,
  // Database
  TestDatabase,
  createTestDatabase,
  // Testing Module
  TestingModule,
  TestingModuleBuilder,
  // Errors
  TestSetupError,
  AssertionError,
} from "../src/index.js";
import type { TestRequest, TestResponse } from "../src/index.js";

// ─── MockFn Tests ────────────────────────────────────────────────────────────

describe("MockFn", () => {
  it("should track calls", () => {
    const fn = mockFn<[string], void>();
    fn.call("hello");
    fn.call("world");
    expect(fn.callCount).toBe(2);
    expect(fn.called).toBe(true);
    expect(fn.calls).toEqual([["hello"], ["world"]]);
  });

  it("should return configured value", () => {
    const fn = mockFn<[], number>();
    fn.returns(42);
    expect(fn.call()).toBe(42);
  });

  it("should return sequential values with returnsOnce", () => {
    const fn = mockFn<[], string>();
    fn.returnsOnce("first").returnsOnce("second").returns("default");
    expect(fn.call()).toBe("first");
    expect(fn.call()).toBe("second");
    expect(fn.call()).toBe("default");
    expect(fn.call()).toBe("default");
  });

  it("should throw configured error", () => {
    const fn = mockFn();
    fn.throws(new Error("boom"));
    expect(() => fn.call()).toThrow("boom");
  });

  it("should throw string error", () => {
    const fn = mockFn();
    fn.throws("fail");
    expect(() => fn.call()).toThrow("fail");
  });

  it("should use custom implementation", () => {
    const fn = mockFn<[number, number], number>();
    fn.implements((a, b) => a + b);
    expect(fn.call(3, 4)).toBe(7);
    expect(fn.callCount).toBe(1);
  });

  it("should check calledWith", () => {
    const fn = mockFn<[string, number], void>();
    fn.call("test", 1);
    fn.call("other", 2);
    expect(fn.calledWith("test", 1)).toBe(true);
    expect(fn.calledWith("nope", 3)).toBe(false);
  });

  it("should get nthCall", () => {
    const fn = mockFn<[string], void>();
    fn.call("a");
    fn.call("b");
    fn.call("c");
    expect(fn.nthCall(0)).toEqual(["a"]);
    expect(fn.nthCall(1)).toEqual(["b"]);
    expect(fn.nthCall(2)).toEqual(["c"]);
    expect(fn.nthCall(5)).toBeUndefined();
  });

  it("should get lastCall", () => {
    const fn = mockFn<[number], void>();
    fn.call(1);
    fn.call(2);
    fn.call(3);
    expect(fn.lastCall).toEqual([3]);
  });

  it("should reset all state", () => {
    const fn = mockFn<[], number>();
    fn.returns(10);
    fn.call();
    fn.reset();
    expect(fn.callCount).toBe(0);
    expect(fn.called).toBe(false);
    expect(fn.call()).toBeUndefined();
  });

  it("should resetCalls but keep configuration", () => {
    const fn = mockFn<[], number>();
    fn.returns(42);
    fn.call();
    fn.resetCalls();
    expect(fn.callCount).toBe(0);
    expect(fn.call()).toBe(42);
  });

  it("should calledWith with deep equality on objects", () => {
    const fn = mockFn<[Record<string, unknown>], void>();
    fn.call({ a: 1, b: [2, 3] });
    expect(fn.calledWith({ a: 1, b: [2, 3] })).toBe(true);
    expect(fn.calledWith({ a: 1, b: [2, 4] })).toBe(false);
  });
});

// ─── createMock Tests ────────────────────────────────────────────────────────

describe("createMock", () => {
  it("should create a mock object with auto-mocked methods", () => {
    interface UserService {
      findById(id: string): string;
      save(data: unknown): void;
    }
    const mock = createMock<UserService>();
    mock.findById("123");
    expect(mock.__mocks.get("findById")!.callCount).toBe(1);
  });

  it("should create mock with specified methods", () => {
    const mock = createMock(["get", "set"]);
    mock.__mocks.get("get")!.returns("value");
    expect((mock as Record<string, (...args: unknown[]) => unknown>).get("key")).toBe("value");
  });

  it("should auto-create methods on access", () => {
    const mock = createMock<{ foo(): string; bar(): number }>();
    (mock as Record<string, (...args: unknown[]) => unknown>).foo();
    (mock as Record<string, (...args: unknown[]) => unknown>).bar();
    expect(mock.__mocks.has("foo")).toBe(true);
    expect(mock.__mocks.has("bar")).toBe(true);
  });
});

// ─── spy Tests ───────────────────────────────────────────────────────────────

describe("spy", () => {
  it("should spy on a method and track calls", () => {
    const obj = {
      greet(name: string): string {
        return `Hello, ${name}!`;
      },
    };
    const spied = spy(obj, "greet");
    const result = obj.greet("World");
    expect(result).toBe("Hello, World!");
    expect(spied.callCount).toBe(1);
    expect(spied.calledWith("World")).toBe(true);
  });

  it("should call original implementation", () => {
    const obj = { add: (a: number, b: number) => a + b };
    const spied = spy(obj, "add");
    expect(obj.add(2, 3)).toBe(5);
    expect(spied.callCount).toBe(1);
  });
});

// ─── TestApp Tests ───────────────────────────────────────────────────────────

describe("TestApp", () => {
  it("should create with providers", () => {
    const TOKEN = Symbol("test");
    const app = createTestApp({
      providers: [{ provide: TOKEN, useValue: "hello" }],
    });
    expect(app.get(TOKEN)).toBe("hello");
    expect(app.has(TOKEN)).toBe(true);
  });

  it("should throw for unknown provider", () => {
    const app = createTestApp();
    expect(() => app.get("unknown")).toThrow(TestSetupError);
  });

  it("should override provider with useValue", () => {
    const TOKEN = Symbol("db");
    const app = createTestApp({
      providers: [{ provide: TOKEN, useValue: "real-db" }],
    });
    app.overrideProvider(TOKEN).useValue("fake-db");
    expect(app.get(TOKEN)).toBe("fake-db");
  });

  it("should override provider with useClass", () => {
    const TOKEN = Symbol("service");
    class FakeService {
      name = "fake";
    }
    const app = createTestApp();
    app.overrideProvider(TOKEN).useClass(FakeService);
    expect(app.get<FakeService>(TOKEN).name).toBe("fake");
  });

  it("should override provider with useFactory", () => {
    const TOKEN = Symbol("config");
    const app = createTestApp();
    app.overrideProvider(TOKEN).useFactory(() => ({ port: 3000 }));
    expect(app.get<{ port: number }>(TOKEN).port).toBe(3000);
  });

  it("should initialize and call onInit", async () => {
    const TOKEN = Symbol("svc");
    let initialized = false;
    const app = createTestApp({
      providers: [
        {
          provide: TOKEN,
          useValue: {
            onInit() {
              initialized = true;
            },
          },
        },
      ],
    });
    await app.init();
    expect(initialized).toBe(true);
    expect(app.isInitialized).toBe(true);
  });

  it("should not double-initialize", async () => {
    let count = 0;
    const TOKEN = Symbol("svc");
    const app = createTestApp({
      providers: [{ provide: TOKEN, useValue: { onInit() { count++; } } }],
    });
    await app.init();
    await app.init();
    expect(count).toBe(1);
  });

  it("should close and call onDestroy", async () => {
    const TOKEN = Symbol("svc");
    let destroyed = false;
    const app = createTestApp({
      providers: [{ provide: TOKEN, useValue: { onDestroy() { destroyed = true; } } }],
    });
    await app.close();
    expect(destroyed).toBe(true);
    expect(app.isDestroyed).toBe(true);
  });

  it("should run cleanup functions on close", async () => {
    const app = createTestApp();
    let cleaned = false;
    app.onCleanup(() => { cleaned = true; });
    await app.close();
    expect(cleaned).toBe(true);
  });

  it("should not double-close", async () => {
    let count = 0;
    const TOKEN = Symbol("svc");
    const app = createTestApp({
      providers: [{ provide: TOKEN, useValue: { onDestroy() { count++; } } }],
    });
    await app.close();
    await app.close();
    expect(count).toBe(1);
  });
});

// ─── TestClient Tests ────────────────────────────────────────────────────────

describe("TestClient", () => {
  function createHandler(): (req: TestRequest) => TestResponse {
    return (req: TestRequest): TestResponse => ({
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "abc" },
      body: { method: req.method, path: req.path, query: req.query, body: req.body },
      text: JSON.stringify({ method: req.method, path: req.path, query: req.query, body: req.body }),
    });
  }

  it("should make GET request", async () => {
    const client = createTestClient(createHandler());
    const response = await client.get("/api/users").execute();
    expect(response.status).toBe(200);
    const body = JSON.parse(response.text);
    expect(body.method).toBe("GET");
    expect(body.path).toBe("/api/users");
  });

  it("should make POST request with body", async () => {
    const client = createTestClient(createHandler());
    const body = await client
      .post("/api/users")
      .send({ name: "John" })
      .expectJson<{ method: string; body: { name: string } }>();
    expect(body.method).toBe("POST");
    expect(body.body.name).toBe("John");
  });

  it("should set headers", async () => {
    const client = createTestClient((req) => ({
      status: 200,
      headers: {},
      body: null,
      text: req.headers["x-custom"] ?? "",
    }));
    const text = await client.get("/").set("X-Custom", "value").expectText();
    expect(text).toBe("value");
  });

  it("should set query parameters", async () => {
    const client = createTestClient(createHandler());
    const body = await client
      .get("/search")
      .query({ q: "test", page: "1" })
      .expectJson<{ query: Record<string, string> }>();
    expect(body.query.q).toBe("test");
    expect(body.query.page).toBe("1");
  });

  it("should set auth token", async () => {
    const client = createTestClient((req) => ({
      status: 200,
      headers: {},
      body: null,
      text: req.headers["authorization"] ?? "",
    }));
    const text = await client.get("/").auth("my-token").expectText();
    expect(text).toBe("Bearer my-token");
  });

  it("should set default headers", async () => {
    const client = createTestClient((req) => ({
      status: 200,
      headers: {},
      body: null,
      text: req.headers["x-api-key"] ?? "",
    }));
    client.setDefaultHeader("X-Api-Key", "secret");
    const text = await client.get("/").expectText();
    expect(text).toBe("secret");
  });

  it("should assert expected status", async () => {
    const client = createTestClient(() => ({
      status: 201,
      headers: {},
      body: null,
      text: "",
    }));
    await expect(client.get("/").expect(200).execute()).rejects.toThrow("Expected status 200, got 201");
  });

  it("should assert expected header presence", async () => {
    const client = createTestClient(() => ({
      status: 200,
      headers: {},
      body: null,
      text: "",
    }));
    await expect(
      client.get("/").expect("x-missing", "val").execute(),
    ).rejects.toThrow('Expected header "x-missing" to be present');
  });

  it("should assert expected header value", async () => {
    const client = createTestClient(() => ({
      status: 200,
      headers: { "content-type": "text/plain" },
      body: null,
      text: "",
    }));
    await expect(
      client.get("/").expect("content-type", "application/json").execute(),
    ).rejects.toThrow('Expected header "content-type" to be "application/json"');
  });

  it("should support PUT, DELETE, PATCH methods", async () => {
    const client = createTestClient(createHandler());

    const put = await client.put("/api/items/1").send({ name: "updated" }).expectJson<{ method: string }>();
    expect(put.method).toBe("PUT");

    const del = await client.delete("/api/items/1").expectJson<{ method: string }>();
    expect(del.method).toBe("DELETE");

    const patch = await client.patch("/api/items/1").send({ name: "patched" }).expectJson<{ method: string }>();
    expect(patch.method).toBe("PATCH");
  });

  it("should auto-set content-type for body", async () => {
    const client = createTestClient((req) => ({
      status: 200,
      headers: {},
      body: null,
      text: req.headers["content-type"] ?? "",
    }));
    const text = await client.post("/").send({ data: 1 }).expectText();
    expect(text).toBe("application/json");
  });
});

// ─── Fixtures Tests ──────────────────────────────────────────────────────────

describe("Fixtures", () => {
  beforeEach(() => {
    clearFixtures();
  });

  it("should register and load a fixture", async () => {
    useFixture("db", () => ({ connection: "test-db" }));
    const data = await loadFixture<{ connection: string }>("db");
    expect(data.connection).toBe("test-db");
  });

  it("should cache loaded fixture", async () => {
    let callCount = 0;
    useFixture("counter", () => {
      callCount++;
      return { count: callCount };
    });
    const first = await loadFixture<{ count: number }>("counter");
    const second = await loadFixture<{ count: number }>("counter");
    expect(first).toBe(second);
    expect(callCount).toBe(1);
  });

  it("should throw for unknown fixture", async () => {
    await expect(loadFixture("nope")).rejects.toThrow(TestSetupError);
  });

  it("should teardown a fixture", async () => {
    let tornDown = false;
    useFixture("svc", () => "data", () => { tornDown = true; });
    await loadFixture("svc");
    await teardownFixture("svc");
    expect(tornDown).toBe(true);
  });

  it("should teardown all fixtures", async () => {
    let count = 0;
    useFixture("a", () => "a", () => { count++; });
    useFixture("b", () => "b", () => { count++; });
    await loadFixture("a");
    await loadFixture("b");
    await teardownAllFixtures();
    expect(count).toBe(2);
  });

  it("should clear fixtures registry", async () => {
    useFixture("test", () => "val");
    clearFixtures();
    await expect(loadFixture("test")).rejects.toThrow();
  });
});

// ─── Factory Tests ───────────────────────────────────────────────────────────

describe("Factory", () => {
  it("should create with defaults", () => {
    const userFactory = defineFactory("user", { name: "John", age: 25 });
    const user = userFactory.create();
    expect(user.name).toBe("John");
    expect(user.age).toBe(25);
  });

  it("should create with overrides", () => {
    const userFactory = defineFactory("user", { name: "John", age: 25 });
    const user = userFactory.create({ name: "Jane" });
    expect(user.name).toBe("Jane");
    expect(user.age).toBe(25);
  });

  it("should create with function defaults", () => {
    let counter = 0;
    const factory = defineFactory("item", () => {
      counter++;
      return { id: counter, label: `item-${counter}` };
    });
    const a = factory.create();
    const b = factory.create();
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it("should create many", () => {
    const factory = defineFactory("post", { title: "Post", views: 0 });
    const posts = factory.createMany(3);
    expect(posts).toHaveLength(3);
    posts.forEach((p) => expect(p.title).toBe("Post"));
  });

  it("should support traits", () => {
    const factory = defineFactory("user", { name: "User", role: "user", active: true });
    factory.trait("admin", { role: "admin" });
    factory.trait("inactive", { active: false });

    const admin = factory.createWithTrait("admin");
    expect(admin.role).toBe("admin");
    expect(admin.active).toBe(true);

    const inactive = factory.createWithTrait("inactive");
    expect(inactive.active).toBe(false);
  });

  it("should throw for unknown trait", () => {
    const factory = defineFactory("user", { name: "test" });
    expect(() => factory.createWithTrait("nope")).toThrow(TestSetupError);
  });

  it("should track sequence", () => {
    const factory = defineFactory("item", { name: "item" });
    expect(factory.sequence).toBe(0);
    factory.create();
    factory.create();
    expect(factory.sequence).toBe(2);
  });

  it("should reset sequence", () => {
    const factory = defineFactory("item", { name: "item" });
    factory.create();
    factory.create();
    factory.resetSequence();
    expect(factory.sequence).toBe(0);
  });

  it("should combine trait with overrides", () => {
    const factory = defineFactory("user", { name: "User", role: "user", email: "" });
    factory.trait("admin", { role: "admin" });
    const user = factory.createWithTrait("admin", { email: "admin@test.com" });
    expect(user.role).toBe("admin");
    expect(user.email).toBe("admin@test.com");
  });
});

// ─── Sequence Tests ──────────────────────────────────────────────────────────

describe("Sequence generators", () => {
  it("should generate string sequences with prefix", () => {
    const nextEmail = sequence("user-");
    expect(nextEmail()).toBe("user-1");
    expect(nextEmail()).toBe("user-2");
    expect(nextEmail()).toBe("user-3");
  });

  it("should generate string sequences without prefix", () => {
    const next = sequence();
    expect(next()).toBe("1");
    expect(next()).toBe("2");
  });

  it("should generate numeric sequences", () => {
    const nextId = numericSequence();
    expect(nextId()).toBe(1);
    expect(nextId()).toBe(2);
    expect(nextId()).toBe(3);
  });

  it("should generate numeric sequences from custom start", () => {
    const nextId = numericSequence(100);
    expect(nextId()).toBe(100);
    expect(nextId()).toBe(101);
  });
});

// ─── Matchers Tests ──────────────────────────────────────────────────────────

describe("Matchers", () => {
  describe("toBeValidResponse", () => {
    it("should pass for 200 status", () => {
      const result = toBeValidResponse({ status: 200, headers: {}, body: null, text: "" });
      expect(result.pass).toBe(true);
    });

    it("should pass for 404 status (valid but not success)", () => {
      const result = toBeValidResponse({ status: 404, headers: {}, body: null, text: "" });
      expect(result.pass).toBe(true);
    });

    it("should fail for 500 status", () => {
      const result = toBeValidResponse({ status: 500, headers: {}, body: null, text: "" });
      expect(result.pass).toBe(false);
    });

    it("should check specific status", () => {
      const pass = toBeValidResponse({ status: 201, headers: {}, body: null, text: "" }, 201);
      expect(pass.pass).toBe(true);
      const fail = toBeValidResponse({ status: 200, headers: {}, body: null, text: "" }, 201);
      expect(fail.pass).toBe(false);
    });
  });

  describe("toHaveHeader", () => {
    it("should pass when header exists", () => {
      const result = toHaveHeader(
        { status: 200, headers: { "content-type": "application/json" }, body: null, text: "" },
        "Content-Type",
      );
      expect(result.pass).toBe(true);
    });

    it("should fail when header is missing", () => {
      const result = toHaveHeader(
        { status: 200, headers: {}, body: null, text: "" },
        "Authorization",
      );
      expect(result.pass).toBe(false);
    });

    it("should check header value", () => {
      const result = toHaveHeader(
        { status: 200, headers: { "content-type": "text/html" }, body: null, text: "" },
        "Content-Type",
        "application/json",
      );
      expect(result.pass).toBe(false);
    });
  });

  describe("toMatchSchema", () => {
    it("should validate type", () => {
      expect(toMatchSchema("hello", { type: "string" }).pass).toBe(true);
      expect(toMatchSchema(42, { type: "number" }).pass).toBe(true);
      expect(toMatchSchema(42, { type: "string" }).pass).toBe(false);
    });

    it("should validate integer type", () => {
      expect(toMatchSchema(42, { type: "integer" }).pass).toBe(true);
      expect(toMatchSchema(3.14, { type: "integer" }).pass).toBe(false);
    });

    it("should validate array type", () => {
      expect(toMatchSchema([1, 2], { type: "array" }).pass).toBe(true);
      expect(toMatchSchema("nope", { type: "array" }).pass).toBe(false);
    });

    it("should validate required properties", () => {
      const schema = { type: "object" as const, required: ["name", "age"] };
      expect(toMatchSchema({ name: "John", age: 25 }, schema).pass).toBe(true);
      expect(toMatchSchema({ name: "John" }, schema).pass).toBe(false);
    });

    it("should validate property types", () => {
      const schema = {
        type: "object" as const,
        properties: { name: { type: "string" }, age: { type: "number" } },
      };
      expect(toMatchSchema({ name: "John", age: 25 }, schema).pass).toBe(true);
      expect(toMatchSchema({ name: 123, age: 25 }, schema).pass).toBe(false);
    });
  });

  describe("toContainEntry", () => {
    it("should pass when entry matches", () => {
      expect(toContainEntry({ a: 1, b: 2 }, "a", 1).pass).toBe(true);
    });

    it("should fail when key missing", () => {
      expect(toContainEntry({ a: 1 }, "b", 2).pass).toBe(false);
    });

    it("should fail when value differs", () => {
      expect(toContainEntry({ a: 1 }, "a", 2).pass).toBe(false);
    });
  });

  describe("toBeWithinRange", () => {
    it("should pass within range", () => {
      expect(toBeWithinRange(5, 1, 10).pass).toBe(true);
      expect(toBeWithinRange(1, 1, 10).pass).toBe(true);
      expect(toBeWithinRange(10, 1, 10).pass).toBe(true);
    });

    it("should fail outside range", () => {
      expect(toBeWithinRange(0, 1, 10).pass).toBe(false);
      expect(toBeWithinRange(11, 1, 10).pass).toBe(false);
    });
  });

  describe("toSatisfy", () => {
    it("should pass when predicate returns true", () => {
      expect(toSatisfy(10, (v) => v > 5).pass).toBe(true);
    });

    it("should fail when predicate returns false", () => {
      expect(toSatisfy(3, (v) => v > 5).pass).toBe(false);
    });

    it("should use custom description", () => {
      const result = toSatisfy(3, (v) => v > 5, "should be greater than 5");
      expect(result.message).toBe("should be greater than 5");
    });
  });
});

// ─── FakeClock Tests ─────────────────────────────────────────────────────────

describe("FakeClock", () => {
  let clock: FakeClock;

  afterEach(() => {
    if (clock) clock.restore();
  });

  it("should create with default time", () => {
    clock = new FakeClock();
    expect(clock.now()).toBeGreaterThan(0);
  });

  it("should create with specific time", () => {
    clock = new FakeClock(1000);
    expect(clock.now()).toBe(1000);
  });

  it("should create with Date object", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    clock = new FakeClock(date);
    expect(clock.now()).toBe(date.getTime());
  });

  it("should install and override Date.now", () => {
    clock = new FakeClock(5000).install();
    expect(Date.now()).toBe(5000);
  });

  it("should advance time with tick", () => {
    clock = new FakeClock(0).install();
    clock.tick(1000);
    expect(Date.now()).toBe(1000);
  });

  it("should fire setTimeout callbacks on tick", () => {
    clock = new FakeClock(0).install();
    let fired = false;
    setTimeout(() => { fired = true; }, 500);
    expect(fired).toBe(false);
    clock.tick(500);
    expect(fired).toBe(true);
  });

  it("should fire setInterval callbacks repeatedly", () => {
    clock = new FakeClock(0).install();
    let count = 0;
    setInterval(() => { count++; }, 100);
    clock.tick(350);
    expect(count).toBe(3);
  });

  it("should support clearTimeout", () => {
    clock = new FakeClock(0).install();
    let fired = false;
    const id = setTimeout(() => { fired = true; }, 100);
    clearTimeout(id);
    clock.tick(200);
    expect(fired).toBe(false);
  });

  it("should support clearInterval", () => {
    clock = new FakeClock(0).install();
    let count = 0;
    const id = setInterval(() => { count++; }, 100);
    clock.tick(250);
    clearInterval(id);
    clock.tick(200);
    expect(count).toBe(2);
  });

  it("should set time directly", () => {
    clock = new FakeClock(0).install();
    clock.setTime(9999);
    expect(clock.now()).toBe(9999);
  });

  it("should track pending timers", () => {
    clock = new FakeClock(0).install();
    setTimeout(() => {}, 100);
    setTimeout(() => {}, 200);
    expect(clock.pendingTimers).toBe(2);
  });

  it("should clear all timers", () => {
    clock = new FakeClock(0).install();
    setTimeout(() => {}, 100);
    setInterval(() => {}, 200);
    clock.clearAllTimers();
    expect(clock.pendingTimers).toBe(0);
  });

  it("should restore original timers", () => {
    const originalNow = Date.now;
    clock = new FakeClock(0).install();
    clock.restore();
    expect(Date.now).toBe(originalNow);
  });

  it("should not double-install", () => {
    clock = new FakeClock(1000);
    const result1 = clock.install();
    const result2 = clock.install();
    expect(result1).toBe(result2);
  });

  it("should useFakeTimers helper", () => {
    clock = useFakeTimers(2000);
    expect(Date.now()).toBe(2000);
  });

  it("should fire timers in chronological order", () => {
    clock = new FakeClock(0).install();
    const order: number[] = [];
    setTimeout(() => { order.push(2); }, 200);
    setTimeout(() => { order.push(1); }, 100);
    setTimeout(() => { order.push(3); }, 300);
    clock.tick(300);
    expect(order).toEqual([1, 2, 3]);
  });
});

// ─── TestDatabase Tests ──────────────────────────────────────────────────────

describe("TestDatabase", () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it("should create tables", () => {
    db.table("users");
    expect(db.hasTable("users")).toBe(true);
    expect(db.tableNames).toContain("users");
  });

  it("should insert and find rows", () => {
    const users = db.table("users");
    users.insert({ name: "Alice", age: 30 });
    users.insert({ name: "Bob", age: 25 });
    const all = users.find();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe("Alice");
  });

  it("should auto-generate ids", () => {
    const items = db.table("items");
    const a = items.insert({ name: "A" });
    const b = items.insert({ name: "B" });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it("should find by id", () => {
    const users = db.table("users");
    users.insert({ name: "Alice" });
    const found = users.findById(1);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Alice");
    expect(users.findById(999)).toBeUndefined();
  });

  it("should find with where clause", () => {
    const users = db.table("users");
    users.insert({ name: "Alice", role: "admin" });
    users.insert({ name: "Bob", role: "user" });
    users.insert({ name: "Charlie", role: "admin" });
    const admins = users.findWhere({ role: "admin" });
    expect(admins).toHaveLength(2);
  });

  it("should find one with predicate", () => {
    const users = db.table("users");
    users.insert({ name: "Alice", age: 30 });
    users.insert({ name: "Bob", age: 25 });
    const young = users.findOne((r) => (r.age as number) < 28);
    expect(young).toBeDefined();
    expect(young!.name).toBe("Bob");
  });

  it("should update rows", () => {
    const users = db.table("users");
    users.insert({ name: "Alice", active: true });
    users.insert({ name: "Bob", active: true });
    const updated = users.update(() => true, { active: false });
    expect(updated).toBe(2);
    expect(users.find().every((r) => r.active === false)).toBe(true);
  });

  it("should update by id", () => {
    const users = db.table("users");
    users.insert({ name: "Alice" });
    const result = users.updateById(1, { name: "Alicia" });
    expect(result).toBe(true);
    expect(users.findById(1)!.name).toBe("Alicia");
    expect(users.updateById(999, { name: "Nope" })).toBe(false);
  });

  it("should delete rows", () => {
    const users = db.table("users");
    users.insert({ name: "Alice" });
    users.insert({ name: "Bob" });
    const deleted = users.delete((r) => r.name === "Alice");
    expect(deleted).toBe(1);
    expect(users.count()).toBe(1);
  });

  it("should delete by id", () => {
    const users = db.table("users");
    users.insert({ name: "Alice" });
    expect(users.deleteById(1)).toBe(true);
    expect(users.count()).toBe(0);
    expect(users.deleteById(999)).toBe(false);
  });

  it("should insert many rows", () => {
    const users = db.table("users");
    const rows = users.insertMany([{ name: "A" }, { name: "B" }, { name: "C" }]);
    expect(rows).toHaveLength(3);
    expect(users.count()).toBe(3);
  });

  it("should count with predicate", () => {
    const users = db.table("users");
    users.insertMany([
      { name: "Alice", role: "admin" },
      { name: "Bob", role: "user" },
      { name: "Charlie", role: "admin" },
    ]);
    expect(users.count()).toBe(3);
    expect(users.count((r) => r.role === "admin")).toBe(2);
  });

  it("should clear table", () => {
    const users = db.table("users");
    users.insertMany([{ name: "A" }, { name: "B" }]);
    users.clear();
    expect(users.count()).toBe(0);
    // Auto-id should reset
    const row = users.insert({ name: "C" });
    expect(row.id).toBe(1);
  });

  it("should drop table", () => {
    db.table("users");
    expect(db.dropTable("users")).toBe(true);
    expect(db.hasTable("users")).toBe(false);
  });

  it("should run seeds", async () => {
    db.seed("users", () => [{ name: "Seed1" }, { name: "Seed2" }]);
    await db.runSeeds();
    expect(db.table("users").count()).toBe(2);
  });

  it("should run specific seed", async () => {
    db.seed("users", () => [{ name: "Alice" }]);
    db.seed("posts", () => [{ title: "Hello" }]);
    await db.runSeed("users");
    expect(db.table("users").count()).toBe(1);
    expect(db.hasTable("posts")).toBe(false);
  });

  it("should throw for unknown seed", async () => {
    await expect(db.runSeed("nope")).rejects.toThrow(TestSetupError);
  });

  it("should snapshot and restore", () => {
    const users = db.table("users");
    users.insertMany([{ name: "Alice" }, { name: "Bob" }]);
    const snap = db.snapshot();
    users.clear();
    expect(users.count()).toBe(0);
    db.restore(snap);
    expect(db.table("users").count()).toBe(2);
  });

  it("should reset database completely", () => {
    db.table("users").insert({ name: "A" });
    db.seed("users", () => []);
    db.reset();
    expect(db.tableNames).toHaveLength(0);
  });

  it("should clear all tables", () => {
    db.table("users").insert({ name: "A" });
    db.table("posts").insert({ title: "B" });
    db.clear();
    expect(db.table("users").count()).toBe(0);
    expect(db.table("posts").count()).toBe(0);
  });
});

// ─── TestingModule Tests ─────────────────────────────────────────────────────

describe("TestingModule", () => {
  it("should compile with providers", async () => {
    const TOKEN = Symbol("test");
    const module = await TestingModule.create()
      .provide(TOKEN, "hello")
      .compile();
    expect(module.get(TOKEN)).toBe("hello");
    expect(module.has(TOKEN)).toBe(true);
    expect(module.isInitialized).toBe(true);
    await module.close();
  });

  it("should override providers", async () => {
    const TOKEN = Symbol("db");
    const module = await TestingModule.create()
      .providers([{ provide: TOKEN, useValue: "real" }])
      .overrideProvider(TOKEN).useValue("fake")
      .compile();
    expect(module.get(TOKEN)).toBe("fake");
    await module.close();
  });

  it("should import module providers", async () => {
    const TOKEN = Symbol("imported");
    const externalModule = {
      providers: [{ provide: TOKEN, useValue: "from-module" }],
    };
    const module = await TestingModule.create()
      .import(externalModule)
      .compile();
    expect(module.get(TOKEN)).toBe("from-module");
    await module.close();
  });

  it("should throw for unknown provider", async () => {
    const module = await TestingModule.create().compile();
    expect(() => module.get("unknown")).toThrow(TestSetupError);
    await module.close();
  });

  it("should run cleanup on close", async () => {
    let cleaned = false;
    const module = await TestingModule.create().compile();
    module.onCleanup(() => { cleaned = true; });
    await module.close();
    expect(cleaned).toBe(true);
    expect(module.isDestroyed).toBe(true);
  });

  it("should override with useFactory", async () => {
    const TOKEN = Symbol("config");
    const module = await TestingModule.create()
      .overrideProvider(TOKEN).useFactory(() => ({ port: 9999 }))
      .compile();
    expect(module.get<{ port: number }>(TOKEN).port).toBe(9999);
    await module.close();
  });

  it("should override with useClass", async () => {
    const TOKEN = Symbol("svc");
    class FakeService { name = "fake"; }
    const module = await TestingModule.create()
      .overrideProvider(TOKEN).useClass(FakeService)
      .compile();
    expect(module.get<FakeService>(TOKEN).name).toBe("fake");
    await module.close();
  });
});

// ─── Error Types Tests ───────────────────────────────────────────────────────

describe("Error types", () => {
  it("should create TestSetupError", () => {
    const err = new TestSetupError("setup failed");
    expect(err).toBeInstanceOf(TestSetupError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("setup failed");
    expect(err.name).toBe("TestSetupError");
    expect(err.code).toBe("TEST_SETUP_ERROR");
  });

  it("should create TestSetupError with custom code", () => {
    const err = new TestSetupError("custom", "CUSTOM_CODE");
    expect(err.code).toBe("CUSTOM_CODE");
  });

  it("should create AssertionError", () => {
    const err = new AssertionError("mismatch", "expected", "actual");
    expect(err).toBeInstanceOf(AssertionError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("mismatch");
    expect(err.expected).toBe("expected");
    expect(err.actual).toBe("actual");
  });
});
