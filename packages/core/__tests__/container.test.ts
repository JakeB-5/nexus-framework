import { describe, it, expect, beforeEach } from "vitest";
import {
  Container,
  Scope,
  DependencyResolutionError,
  CircularDependencyError,
  createToken,
  setInjectableMetadata,
} from "../src/index.js";

// Helper: simulate @Injectable without parameter decorator syntax
function makeInjectable(
  ctor: new (...args: never[]) => unknown,
  options?: { scope?: Scope },
) {
  setInjectableMetadata(ctor, { scope: options?.scope ?? Scope.Singleton });
}

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe("basic registration and resolution", () => {
    it("should register and resolve a class", () => {
      class MyService {
        getValue() {
          return 42;
        }
      }
      makeInjectable(MyService);

      container.register(MyService);
      const instance = container.resolve(MyService);
      expect(instance).toBeInstanceOf(MyService);
      expect(instance.getValue()).toBe(42);
    });

    it("should register and resolve a value", () => {
      const token = createToken<string>("API_KEY");
      container.registerValue(token, "secret-key");
      expect(container.resolve(token)).toBe("secret-key");
    });

    it("should register and resolve with string token", () => {
      container.registerValue("config.port", 3000);
      expect(container.resolve("config.port")).toBe(3000);
    });

    it("should register and resolve with symbol token", () => {
      const token = Symbol("myToken");
      container.registerValue(token, { hello: "world" });
      expect(container.resolve(token)).toEqual({ hello: "world" });
    });

    it("should throw DependencyResolutionError for unregistered token", () => {
      expect(() => container.resolve("nonexistent")).toThrow(
        DependencyResolutionError,
      );
    });

    it("should check existence with has()", () => {
      container.registerValue("exists", true);
      expect(container.has("exists")).toBe(true);
      expect(container.has("missing")).toBe(false);
    });

    it("should return registered tokens", () => {
      container.registerValue("a", 1);
      container.registerValue("b", 2);
      const tokens = container.getRegisteredTokens();
      expect(tokens).toContain("a");
      expect(tokens).toContain("b");
    });
  });

  describe("provider types", () => {
    it("should resolve ClassProvider", () => {
      class Foo {
        name = "foo";
      }
      makeInjectable(Foo);

      container.register({
        provide: "MyFoo",
        useClass: Foo,
      });

      const instance = container.resolve("MyFoo");
      expect(instance).toBeInstanceOf(Foo);
    });

    it("should resolve ValueProvider", () => {
      container.register({
        provide: "CONFIG",
        useValue: { port: 3000 },
      });

      expect(container.resolve("CONFIG")).toEqual({ port: 3000 });
    });

    it("should resolve FactoryProvider", () => {
      container.registerValue("PORT", 8080);
      container.register({
        provide: "URL",
        useFactory: (port: unknown) => `http://localhost:${port}`,
        inject: ["PORT"],
      });

      expect(container.resolve("URL")).toBe("http://localhost:8080");
    });

    it("should resolve ExistingProvider (alias)", () => {
      container.registerValue("original", "hello");
      container.register({
        provide: "alias",
        useExisting: "original",
      });

      expect(container.resolve("alias")).toBe("hello");
    });

    it("should resolve factory with no dependencies", () => {
      container.registerFactory("timestamp", () => Date.now());
      const ts = container.resolve<number>("timestamp");
      expect(typeof ts).toBe("number");
    });
  });

  describe("scopes", () => {
    it("should return same instance for Singleton scope", () => {
      class SingletonService {}
      makeInjectable(SingletonService, { scope: Scope.Singleton });

      container.register(SingletonService);
      const a = container.resolve(SingletonService);
      const b = container.resolve(SingletonService);
      expect(a).toBe(b);
    });

    it("should return different instances for Transient scope", () => {
      class TransientService {}
      makeInjectable(TransientService, { scope: Scope.Transient });

      container.register(TransientService);
      const a = container.resolve(TransientService);
      const b = container.resolve(TransientService);
      expect(a).not.toBe(b);
    });

    it("should return same instance within a scope for Scoped", () => {
      class ScopedService {}
      makeInjectable(ScopedService, { scope: Scope.Scoped });

      container.register(ScopedService);
      const scope = container.createScope();
      const a = scope.resolve(ScopedService);
      const b = scope.resolve(ScopedService);
      expect(a).toBe(b);
    });

    it("should return different instances in different scopes", () => {
      class ScopedService {}
      makeInjectable(ScopedService, { scope: Scope.Scoped });

      container.register(ScopedService);
      const scope1 = container.createScope();
      const scope2 = container.createScope();
      const a = scope1.resolve(ScopedService);
      const b = scope2.resolve(ScopedService);
      expect(a).not.toBe(b);
    });
  });

  describe("dependency injection via factory", () => {
    it("should inject dependencies via factory provider", () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }
      makeInjectable(Logger);
      container.register(Logger);

      class Service {
        constructor(public logger: Logger) {}
      }

      container.register({
        provide: Service,
        useFactory: (logger: unknown) => new Service(logger as Logger),
        inject: [Logger],
      });

      const service = container.resolve(Service);
      expect(service.logger).toBeInstanceOf(Logger);
      expect(service.logger.log("hello")).toBe("hello");
    });

    it("should inject string-token dependencies via factory", () => {
      container.registerValue("DB_URL", "postgres://localhost");

      class DbService {
        constructor(public url: string) {}
      }

      container.register({
        provide: DbService,
        useFactory: (url: unknown) => new DbService(url as string),
        inject: ["DB_URL"],
      });

      const db = container.resolve(DbService);
      expect(db.url).toBe("postgres://localhost");
    });

    it("should handle missing factory dependencies", () => {
      container.register({
        provide: "svc",
        useFactory: (_dep: unknown) => ({ dep: _dep }),
        inject: ["REQUIRED"],
      });

      expect(() => container.resolve("svc")).toThrow(
        DependencyResolutionError,
      );
    });
  });

  describe("circular dependency detection", () => {
    it("should detect direct circular dependencies", () => {
      const tokenA = createToken("A");
      const tokenB = createToken("B");

      container.registerFactory(tokenA, () => container.resolve(tokenB), {
        inject: [],
      });
      container.registerFactory(tokenB, () => container.resolve(tokenA), {
        inject: [],
      });

      expect(() => container.resolve(tokenA)).toThrow(
        CircularDependencyError,
      );
    });
  });

  describe("child containers", () => {
    it("should inherit parent registrations", () => {
      container.registerValue("parent-val", "from-parent");
      const child = container.createChild();
      expect(child.resolve("parent-val")).toBe("from-parent");
    });

    it("should override parent registrations", () => {
      container.registerValue("val", "parent");
      const child = container.createChild();
      child.registerValue("val", "child");
      expect(child.resolve("val")).toBe("child");
      expect(container.resolve("val")).toBe("parent");
    });

    it("should not affect parent when child registers new token", () => {
      const child = container.createChild();
      child.registerValue("child-only", true);
      expect(child.has("child-only")).toBe(true);
      expect(container.has("child-only")).toBe(false);
    });

    it("should check parent with has()", () => {
      container.registerValue("parent-val", 1);
      const child = container.createChild();
      expect(child.has("parent-val")).toBe(true);
    });
  });

  describe("async resolution", () => {
    it("should resolve async factory", async () => {
      container.register({
        provide: "async-val",
        useFactory: async () => {
          return "async-result";
        },
      });

      const result = await container.resolveAsync("async-val");
      expect(result).toBe("async-result");
    });

    it("should throw when resolving async factory synchronously", () => {
      container.register({
        provide: "async-val",
        useFactory: async () => "result",
      });

      expect(() => container.resolve("async-val")).toThrow(
        DependencyResolutionError,
      );
    });

    it("should resolve async with dependencies", async () => {
      container.registerValue("base", 10);
      container.register({
        provide: "computed",
        useFactory: async (base: unknown) => (base as number) * 2,
        inject: ["base"],
      });

      const result = await container.resolveAsync<number>("computed");
      expect(result).toBe(20);
    });
  });

  describe("disposal", () => {
    it("should call dispose on disposable singleton instances", async () => {
      let disposed = false;

      class DisposableService {
        dispose() {
          disposed = true;
        }
      }
      makeInjectable(DisposableService);

      container.register(DisposableService);
      container.resolve(DisposableService);
      await container.dispose();
      expect(disposed).toBe(true);
    });

    it("should dispose scoped instances when scope is disposed", async () => {
      let disposed = false;

      class ScopedService {
        dispose() {
          disposed = true;
        }
      }
      makeInjectable(ScopedService, { scope: Scope.Scoped });

      container.register(ScopedService);
      const scope = container.createScope();
      scope.resolve(ScopedService);
      await scope.dispose();
      expect(disposed).toBe(true);
    });

    it("should throw on operations after disposal", async () => {
      await container.dispose();
      expect(() => container.resolve("anything")).toThrow(
        "Container has been disposed",
      );
    });

    it("should dispose child containers", async () => {
      let childDisposed = false;

      const child = container.createChild();
      child.registerValue("test", {
        dispose() {
          childDisposed = true;
        },
      });
      child.resolve("test");

      await container.dispose();
      expect(childDisposed).toBe(true);
    });
  });
});
