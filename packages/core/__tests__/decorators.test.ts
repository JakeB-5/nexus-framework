import { describe, it, expect } from "vitest";
import {
  Injectable,
  Module,
  getInjectableMetadata,
  isInjectable,
  getInjectTokens,
  getOptionalParams,
  getModuleMetadata,
  isModule,
  setInjectableMetadata,
  setModuleMetadata,
  Scope,
  Inject,
  Optional,
} from "../src/index.js";

describe("Decorators", () => {
  describe("@Injectable", () => {
    it("should mark a class as injectable with default Singleton scope", () => {
      @Injectable()
      class MyService {}

      const meta = getInjectableMetadata(MyService);
      expect(meta).toBeDefined();
      expect(meta!.scope).toBe(Scope.Singleton);
    });

    it("should accept custom scope", () => {
      @Injectable({ scope: Scope.Transient })
      class TransientService {}

      const meta = getInjectableMetadata(TransientService);
      expect(meta).toBeDefined();
      expect(meta!.scope).toBe(Scope.Transient);
    });

    it("should mark class as injectable via isInjectable", () => {
      @Injectable()
      class A {}
      class B {}

      expect(isInjectable(A)).toBe(true);
      expect(isInjectable(B)).toBe(false);
    });

    it("should handle scoped scope", () => {
      @Injectable({ scope: Scope.Scoped })
      class ScopedService {}

      const meta = getInjectableMetadata(ScopedService);
      expect(meta!.scope).toBe(Scope.Scoped);
    });

    it("should return undefined for undecorated class", () => {
      class Plain {}
      expect(getInjectableMetadata(Plain)).toBeUndefined();
    });
  });

  describe("Inject metadata (programmatic)", () => {
    // esbuild doesn't support parameter decorators, so we test via programmatic API
    it("should store injection token for a parameter", () => {
      const TOKEN = Symbol("token");
      class Service {}
      Inject(TOKEN)(Service, undefined, 0);

      const tokens = getInjectTokens(Service);
      expect(tokens.get(0)).toBe(TOKEN);
    });

    it("should store multiple injection tokens", () => {
      class Service {}
      Inject("A")(Service, undefined, 0);
      Inject("B")(Service, undefined, 1);

      const tokens = getInjectTokens(Service);
      expect(tokens.get(0)).toBe("A");
      expect(tokens.get(1)).toBe("B");
    });

    it("should support class tokens", () => {
      class Dep {}
      class Service {}
      Inject(Dep)(Service, undefined, 0);

      const tokens = getInjectTokens(Service);
      expect(tokens.get(0)).toBe(Dep);
    });

    it("should return empty map for class with no inject decorators", () => {
      class Plain {}
      const tokens = getInjectTokens(Plain);
      expect(tokens.size).toBe(0);
    });
  });

  describe("Optional metadata (programmatic)", () => {
    it("should mark a parameter as optional", () => {
      class Service {}
      Optional()(Service, undefined, 0);

      const optionals = getOptionalParams(Service);
      expect(optionals.has(0)).toBe(true);
    });

    it("should support multiple optional params", () => {
      class Service {}
      Optional()(Service, undefined, 1);
      Optional()(Service, undefined, 2);

      const optionals = getOptionalParams(Service);
      expect(optionals.has(0)).toBe(false);
      expect(optionals.has(1)).toBe(true);
      expect(optionals.has(2)).toBe(true);
    });

    it("should return empty set for class with no optionals", () => {
      class Plain {}
      const optionals = getOptionalParams(Plain);
      expect(optionals.size).toBe(0);
    });
  });

  describe("@Module", () => {
    it("should store module metadata", () => {
      @Module({ providers: [], exports: [] })
      class TestModule {}

      const meta = getModuleMetadata(TestModule);
      expect(meta).toBeDefined();
      expect(meta!.providers).toEqual([]);
      expect(meta!.exports).toEqual([]);
    });

    it("should store imports", () => {
      @Module({})
      class DepModule {}

      @Module({ imports: [DepModule] })
      class MainModule {}

      const meta = getModuleMetadata(MainModule);
      expect(meta!.imports).toContain(DepModule);
    });

    it("should mark module as injectable automatically", () => {
      @Module({})
      class TestModule {}
      expect(isInjectable(TestModule)).toBe(true);
    });

    it("should detect modules with isModule", () => {
      @Module({})
      class A {}
      class B {}

      expect(isModule(A)).toBe(true);
      expect(isModule(B)).toBe(false);
    });

    it("should support global flag", () => {
      @Module({ global: true })
      class GlobalModule {}

      const meta = getModuleMetadata(GlobalModule);
      expect(meta!.global).toBe(true);
    });

    it("should return undefined for non-module class", () => {
      class NotAModule {}
      expect(getModuleMetadata(NotAModule)).toBeUndefined();
    });
  });

  describe("programmatic metadata setters", () => {
    it("should set injectable metadata programmatically", () => {
      class Dynamic {}
      setInjectableMetadata(Dynamic, { scope: Scope.Transient });
      expect(isInjectable(Dynamic)).toBe(true);
      expect(getInjectableMetadata(Dynamic)!.scope).toBe(Scope.Transient);
    });

    it("should set module metadata programmatically", () => {
      class Dynamic {}
      setModuleMetadata(Dynamic, { providers: [], global: true });
      expect(isModule(Dynamic)).toBe(true);
      expect(getModuleMetadata(Dynamic)!.global).toBe(true);
    });
  });
});
