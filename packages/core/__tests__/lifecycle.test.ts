import { describe, it, expect, beforeEach } from "vitest";
import {
  LifecycleManager,
  LifecycleError,
  HookRegistry,
  HookNames,
} from "../src/index.js";

describe("LifecycleManager", () => {
  let manager: LifecycleManager;

  beforeEach(() => {
    manager = new LifecycleManager();
  });

  it("should call onInit on instances", async () => {
    let initialized = false;
    const instance = {
      onInit() {
        initialized = true;
      },
    };

    manager.addInstance(instance, "TestService");
    await manager.init();
    expect(initialized).toBe(true);
  });

  it("should call onReady on instances after init", async () => {
    let ready = false;
    const instance = {
      onInit() {},
      onReady() {
        ready = true;
      },
    };

    manager.addInstance(instance, "TestService");
    await manager.init();
    await manager.ready_();
    expect(ready).toBe(true);
  });

  it("should throw if ready is called before init", async () => {
    await expect(manager.ready_()).rejects.toThrow(LifecycleError);
  });

  it("should call onDestroy in reverse registration order", async () => {
    const order: string[] = [];

    const first = {
      onInit() {},
      onDestroy() {
        order.push("first");
      },
    };
    const second = {
      onInit() {},
      onDestroy() {
        order.push("second");
      },
    };

    manager.addInstance(first, "First");
    manager.addInstance(second, "Second");
    await manager.init();
    await manager.destroy();

    expect(order).toEqual(["second", "first"]);
  });

  it("should collect destroy errors instead of stopping", async () => {
    const instance1 = {
      onDestroy() {
        throw new Error("fail1");
      },
    };
    const instance2 = {
      onDestroy() {
        throw new Error("fail2");
      },
    };

    manager.addInstance(instance1, "A");
    manager.addInstance(instance2, "B");
    await manager.init();

    await expect(manager.destroy()).rejects.toThrow(LifecycleError);
  });

  it("should throw LifecycleError when init fails", async () => {
    const instance = {
      onInit() {
        throw new Error("init failed");
      },
    };

    manager.addInstance(instance, "FailService");
    await expect(manager.init()).rejects.toThrow(LifecycleError);
  });

  it("should handle graceful shutdown", async () => {
    let destroyed = false;
    const instance = {
      onInit() {},
      onDestroy() {
        destroyed = true;
      },
    };

    manager.addInstance(instance, "Service");
    await manager.init();
    await manager.gracefulShutdown(5000);
    expect(destroyed).toBe(true);
  });

  it("should timeout on graceful shutdown", async () => {
    const instance = {
      onInit() {},
      onDestroy() {
        return new Promise((resolve) => setTimeout(resolve, 10000));
      },
    };

    manager.addInstance(instance, "SlowService");
    await manager.init();

    await expect(manager.gracefulShutdown(50)).rejects.toThrow(
      "timed out",
    );
  });

  it("should skip instances without lifecycle methods", async () => {
    const plain = { name: "plain" };
    manager.addInstance(plain, "Plain");
    await manager.init();
    await manager.ready_();
    await manager.destroy();
    // No errors means success
  });

  it("should report instance count", () => {
    manager.addInstance({}, "A");
    manager.addInstance({}, "B");
    expect(manager.getInstanceCount()).toBe(2);
  });

  it("should not init twice", async () => {
    let count = 0;
    const instance = {
      onInit() {
        count++;
      },
    };

    manager.addInstance(instance, "Service");
    await manager.init();
    await manager.init(); // Should be no-op
    expect(count).toBe(1);
  });

  it("should track initialized and ready state", async () => {
    expect(manager.isInitialized()).toBe(false);
    expect(manager.isReady()).toBe(false);

    const instance = { onInit() {}, onReady() {} };
    manager.addInstance(instance, "Svc");
    await manager.init();
    expect(manager.isInitialized()).toBe(true);
    expect(manager.isReady()).toBe(false);

    await manager.ready_();
    expect(manager.isReady()).toBe(true);
  });

  it("should execute lifecycle hooks via HookRegistry", async () => {
    const hookRegistry = new HookRegistry();
    const mgr = new LifecycleManager(hookRegistry);

    const hookOrder: string[] = [];
    hookRegistry.register(HookNames.BEFORE_INIT, () => {
      hookOrder.push("before-init");
    });
    hookRegistry.register(HookNames.AFTER_INIT, () => {
      hookOrder.push("after-init");
    });

    const instance = {
      onInit() {
        hookOrder.push("init");
      },
    };

    mgr.addInstance(instance, "Svc");
    await mgr.init();

    expect(hookOrder).toEqual(["before-init", "init", "after-init"]);
  });
});
