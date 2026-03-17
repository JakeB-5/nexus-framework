import { describe, it, expect, beforeEach } from "vitest";
import {
  HookRegistry,
  HookExecutor,
  HookExecutionError,
  HookNames,
} from "../src/index.js";

describe("HookRegistry", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  it("should register a hook", () => {
    registry.register("test", () => {});
    expect(registry.hasHooks("test")).toBe(true);
  });

  it("should return false for unregistered hooks", () => {
    expect(registry.hasHooks("unknown")).toBe(false);
  });

  it("should unsubscribe via returned function", () => {
    const unsub = registry.register("test", () => {});
    expect(registry.hasHooks("test")).toBe(true);
    unsub();
    expect(registry.hasHooks("test")).toBe(false);
  });

  it("should sort hooks by priority", () => {
    registry.register("test", () => {}, { priority: 50, label: "first" });
    registry.register("test", () => {}, { priority: 10, label: "second" });
    registry.register("test", () => {}, { priority: 30, label: "third" });

    const hooks = registry.getHooks("test");
    expect(hooks[0].label).toBe("second");
    expect(hooks[1].label).toBe("third");
    expect(hooks[2].label).toBe("first");
  });

  it("should use default priority of 100", () => {
    registry.register("test", () => {}, { label: "default" });
    const hooks = registry.getHooks("test");
    expect(hooks[0].priority).toBe(100);
  });

  it("should clear hooks by name", () => {
    registry.register("a", () => {});
    registry.register("b", () => {});
    registry.clear("a");
    expect(registry.hasHooks("a")).toBe(false);
    expect(registry.hasHooks("b")).toBe(true);
  });

  it("should clear all hooks", () => {
    registry.register("a", () => {});
    registry.register("b", () => {});
    registry.clearAll();
    expect(registry.getNames()).toHaveLength(0);
  });

  it("should list registered names", () => {
    registry.register("alpha", () => {});
    registry.register("beta", () => {});
    const names = registry.getNames();
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
  });

  it("should return empty array for unknown hook name", () => {
    expect(registry.getHooks("unknown")).toEqual([]);
  });
});

describe("HookExecutor", () => {
  let registry: HookRegistry;
  let executor: HookExecutor;

  beforeEach(() => {
    registry = new HookRegistry();
    executor = new HookExecutor(registry);
  });

  it("should execute hooks in priority order", async () => {
    const order: number[] = [];
    registry.register("test", () => { order.push(1); }, { priority: 10 });
    registry.register("test", () => { order.push(2); }, { priority: 20 });
    registry.register("test", () => { order.push(3); }, { priority: 30 });

    await executor.execute("test", {});
    expect(order).toEqual([1, 2, 3]);
  });

  it("should pass context to hooks", async () => {
    let received: unknown;
    registry.register("test", (ctx) => { received = ctx; });

    const context = { key: "value" };
    await executor.execute("test", context);
    expect(received).toBe(context);
  });

  it("should throw HookExecutionError on failure", async () => {
    registry.register("test", () => {
      throw new Error("boom");
    }, { label: "failing" });

    await expect(executor.execute("test", {})).rejects.toThrow(
      HookExecutionError,
    );
  });

  it("should stop execution on first error by default", async () => {
    const executed: string[] = [];
    registry.register("test", () => { executed.push("a"); }, { priority: 1 });
    registry.register("test", () => { throw new Error("fail"); }, { priority: 2, label: "b" });
    registry.register("test", () => { executed.push("c"); }, { priority: 3 });

    await expect(executor.execute("test", {})).rejects.toThrow();
    expect(executed).toEqual(["a"]);
  });

  it("should collect all errors with executeAll", async () => {
    registry.register("test", () => { throw new Error("fail1"); }, { label: "a" });
    registry.register("test", () => { throw new Error("fail2"); }, { label: "b" });

    const errors = await executor.executeAll("test", {});
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBeInstanceOf(HookExecutionError);
    expect(errors[1]).toBeInstanceOf(HookExecutionError);
  });

  it("should return empty errors array when all hooks succeed", async () => {
    registry.register("test", () => {});
    registry.register("test", () => {});

    const errors = await executor.executeAll("test", {});
    expect(errors).toHaveLength(0);
  });

  it("should handle async hooks", async () => {
    let result = 0;
    registry.register("test", async () => {
      await new Promise((r) => setTimeout(r, 10));
      result = 42;
    });

    await executor.execute("test", {});
    expect(result).toBe(42);
  });

  it("should do nothing for hooks with no registrations", async () => {
    await executor.execute("nonexistent", {});
    // No error means success
  });

  it("should timeout hooks with executeWithTimeout", async () => {
    registry.register("test", async () => {
      await new Promise((r) => setTimeout(r, 10000));
    }, { label: "slow" });

    await expect(
      executor.executeWithTimeout("test", {}, 50),
    ).rejects.toThrow(HookExecutionError);
  });

  it("should pass with executeWithTimeout when hooks complete fast", async () => {
    registry.register("test", () => {}, { label: "fast" });
    await executor.executeWithTimeout("test", {}, 5000);
    // No error means success
  });
});

describe("HookNames", () => {
  it("should have well-known hook names", () => {
    expect(HookNames.BEFORE_INIT).toBe("nexus:before:init");
    expect(HookNames.AFTER_INIT).toBe("nexus:after:init");
    expect(HookNames.BEFORE_READY).toBe("nexus:before:ready");
    expect(HookNames.AFTER_READY).toBe("nexus:after:ready");
    expect(HookNames.BEFORE_DESTROY).toBe("nexus:before:destroy");
    expect(HookNames.AFTER_DESTROY).toBe("nexus:after:destroy");
  });
});
