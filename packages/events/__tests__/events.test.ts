import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  EventBus,
  EventEmitter,
  EventModule,
  EventTimeoutError,
  OnEvent,
  getEventHandlers,
  hasEventHandlers,
} from "../src/index.js";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe("on / emit", () => {
    it("should emit and receive events", async () => {
      const received: string[] = [];
      bus.on<string>("test", (data) => {
        received.push(data);
      });

      await bus.emit("test", "hello");
      expect(received).toEqual(["hello"]);
    });

    it("should support multiple handlers", async () => {
      const received: number[] = [];
      bus.on("test", () => received.push(1));
      bus.on("test", () => received.push(2));

      await bus.emit("test", null);
      expect(received).toEqual([1, 2]);
    });

    it("should return unsubscribe function", async () => {
      const received: string[] = [];
      const unsub = bus.on<string>("test", (data) => {
        received.push(data);
      });

      await bus.emit("test", "first");
      unsub();
      await bus.emit("test", "second");

      expect(received).toEqual(["first"]);
    });

    it("should handle async handlers", async () => {
      let result = 0;
      bus.on("test", async () => {
        await new Promise((r) => setTimeout(r, 10));
        result = 42;
      });

      await bus.emit("test", null);
      expect(result).toBe(42);
    });

    it("should pass typed data to handlers", async () => {
      interface UserEvent {
        id: string;
        name: string;
      }

      let received: UserEvent | null = null;
      bus.on<UserEvent>("user.created", (data) => {
        received = data;
      });

      await bus.emit("user.created", { id: "1", name: "Alice" });
      expect(received).toEqual({ id: "1", name: "Alice" });
    });
  });

  describe("once", () => {
    it("should fire handler only once", async () => {
      let count = 0;
      bus.once("test", () => {
        count++;
      });

      await bus.emit("test", null);
      await bus.emit("test", null);
      await bus.emit("test", null);

      expect(count).toBe(1);
    });

    it("should return unsubscribe function", async () => {
      let called = false;
      const unsub = bus.once("test", () => {
        called = true;
      });

      unsub();
      await bus.emit("test", null);
      expect(called).toBe(false);
    });
  });

  describe("off", () => {
    it("should remove a specific handler", async () => {
      const received: string[] = [];
      const handler = (data: string) => {
        received.push(data);
      };
      bus.on("test", handler);
      bus.off("test", handler);

      await bus.emit("test", "hello");
      expect(received).toEqual([]);
    });

    it("should not error when removing non-existent handler", () => {
      expect(() => bus.off("test", () => {})).not.toThrow();
    });
  });

  describe("wildcard subscriptions", () => {
    it("should match * to all events", async () => {
      const received: string[] = [];
      bus.on("*", (data) => {
        received.push(data as string);
      });

      await bus.emit("foo", "a");
      await bus.emit("bar", "b");
      await bus.emit("baz.qux", "c");

      expect(received).toEqual(["a", "b", "c"]);
    });

    it("should match prefix wildcards", async () => {
      const received: string[] = [];
      bus.on("user.*", (data) => {
        received.push(data as string);
      });

      await bus.emit("user.created", "a");
      await bus.emit("user.deleted", "b");
      await bus.emit("order.created", "c"); // Should not match

      expect(received).toEqual(["a", "b"]);
    });

    it("should not match partial prefix", async () => {
      const received: string[] = [];
      bus.on("user.*", (data) => {
        received.push(data as string);
      });

      await bus.emit("username.changed", "a"); // "username" != "user"
      expect(received).toEqual([]);
    });
  });

  describe("error isolation", () => {
    it("should continue executing handlers after one fails", async () => {
      const received: number[] = [];

      bus.on("test", () => {
        received.push(1);
      }, { priority: 1 });
      bus.on("test", () => {
        throw new Error("handler 2 failed");
      }, { priority: 2 });
      bus.on("test", () => {
        received.push(3);
      }, { priority: 3 });

      const errors = await bus.emit("test", null);

      expect(received).toEqual([1, 3]);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("handler 2 failed");
    });

    it("should return empty errors when all succeed", async () => {
      bus.on("test", () => {});
      const errors = await bus.emit("test", null);
      expect(errors).toEqual([]);
    });

    it("should handle non-Error throws", async () => {
      bus.on("test", () => {
        throw "string error";
      });

      const errors = await bus.emit("test", null);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("string error");
    });
  });

  describe("priority ordering", () => {
    it("should execute handlers in priority order (lower first)", async () => {
      const order: string[] = [];

      bus.on("test", () => { order.push("c"); }, { priority: 300 });
      bus.on("test", () => { order.push("a"); }, { priority: 100 });
      bus.on("test", () => { order.push("b"); }, { priority: 200 });

      await bus.emit("test", null);
      expect(order).toEqual(["a", "b", "c"]);
    });

    it("should use default priority of 100", async () => {
      const order: string[] = [];

      bus.on("test", () => { order.push("explicit"); }, { priority: 50 });
      bus.on("test", () => { order.push("default"); });

      await bus.emit("test", null);
      expect(order).toEqual(["explicit", "default"]);
    });
  });

  describe("waitFor", () => {
    it("should resolve when event is emitted", async () => {
      setTimeout(() => {
        void bus.emit("ready", { status: "ok" });
      }, 10);

      const data = await bus.waitFor<{ status: string }>("ready", 5000);
      expect(data.status).toBe("ok");
    });

    it("should timeout if event is not emitted", async () => {
      await expect(bus.waitFor("never", 50)).rejects.toThrow(
        EventTimeoutError,
      );
    });

    it("should resolve with correct data type", async () => {
      setTimeout(() => {
        void bus.emit("data", 42);
      }, 10);

      const result = await bus.waitFor<number>("data", 5000);
      expect(result).toBe(42);
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all listeners for a specific event", async () => {
      let count = 0;
      bus.on("a", () => { count++; });
      bus.on("a", () => { count++; });
      bus.on("b", () => { count++; });

      bus.removeAllListeners("a");
      await bus.emit("a", null);
      await bus.emit("b", null);

      expect(count).toBe(1); // Only "b" handler
    });

    it("should remove all listeners when no event specified", async () => {
      let count = 0;
      bus.on("a", () => { count++; });
      bus.on("b", () => { count++; });

      bus.removeAllListeners();
      await bus.emit("a", null);
      await bus.emit("b", null);

      expect(count).toBe(0);
    });
  });

  describe("listenerCount / eventNames", () => {
    it("should return correct listener count", () => {
      bus.on("test", () => {});
      bus.on("test", () => {});
      bus.on("other", () => {});

      expect(bus.listenerCount("test")).toBe(2);
      expect(bus.listenerCount("other")).toBe(1);
      expect(bus.listenerCount("missing")).toBe(0);
    });

    it("should return registered event names", () => {
      bus.on("alpha", () => {});
      bus.on("beta", () => {});

      const names = bus.eventNames();
      expect(names).toContain("alpha");
      expect(names).toContain("beta");
    });
  });

  describe("emit with no listeners", () => {
    it("should not error when emitting to empty bus", async () => {
      const errors = await bus.emit("nobody-listening", "data");
      expect(errors).toEqual([]);
    });
  });

  describe("max listeners warning", () => {
    it("should warn when exceeding max listeners", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const limitedBus = new EventBus({ maxListeners: 2 });

      limitedBus.on("test", () => {});
      limitedBus.on("test", () => {});
      limitedBus.on("test", () => {}); // Should trigger warning

      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });
});

describe("EventEmitter", () => {
  it("should subscribe and emit events", async () => {
    class MyEmitter extends EventEmitter {
      async doSomething(): Promise<Error[]> {
        return this.emit("done", { result: 42 });
      }
    }

    const emitter = new MyEmitter();
    let received: unknown = null;
    emitter.on("done", (data) => {
      received = data;
    });

    await emitter.doSomething();
    expect(received).toEqual({ result: 42 });
  });

  it("should support once subscriptions", async () => {
    class MyEmitter extends EventEmitter {
      async fire(): Promise<Error[]> {
        return this.emit("event", null);
      }
    }

    const emitter = new MyEmitter();
    let count = 0;
    emitter.once("event", () => { count++; });

    await emitter.fire();
    await emitter.fire();
    expect(count).toBe(1);
  });

  it("should support off", async () => {
    class MyEmitter extends EventEmitter {
      async fire(): Promise<Error[]> {
        return this.emit("event", null);
      }
    }

    const emitter = new MyEmitter();
    let count = 0;
    const handler = () => { count++; };
    emitter.on("event", handler);
    emitter.off("event", handler);

    await emitter.fire();
    expect(count).toBe(0);
  });

  it("should support waitFor", async () => {
    class MyEmitter extends EventEmitter {
      async fire(): Promise<Error[]> {
        return this.emit("ready", "data");
      }
    }

    const emitter = new MyEmitter();
    setTimeout(() => { void emitter.fire(); }, 10);

    const result = await emitter.waitFor<string>("ready", 5000);
    expect(result).toBe("data");
  });

  it("should support removeAllListeners", async () => {
    class MyEmitter extends EventEmitter {
      async fire(): Promise<Error[]> {
        return this.emit("event", null);
      }
    }

    const emitter = new MyEmitter();
    let count = 0;
    emitter.on("event", () => { count++; });
    emitter.removeAllListeners();

    await emitter.fire();
    expect(count).toBe(0);
  });
});

describe("@OnEvent decorator (programmatic)", () => {
  it("should store event handler metadata", () => {
    class Listener {
      handleUserCreated() {}
      handleUserDeleted() {}
    }

    // Apply decorators programmatically (esbuild doesn't support legacy method decorators)
    OnEvent("user.created")(
      Listener.prototype,
      "handleUserCreated",
      Object.getOwnPropertyDescriptor(Listener.prototype, "handleUserCreated")!,
    );
    OnEvent("user.deleted", { priority: 50 })(
      Listener.prototype,
      "handleUserDeleted",
      Object.getOwnPropertyDescriptor(Listener.prototype, "handleUserDeleted")!,
    );

    const handlers = getEventHandlers(Listener);
    expect(handlers).toHaveLength(2);
    expect(handlers[0].event).toBe("user.created");
    expect(handlers[0].method).toBe("handleUserCreated");
    expect(handlers[1].event).toBe("user.deleted");
    expect(handlers[1].priority).toBe(50);
  });

  it("should detect classes with event handlers", () => {
    class WithHandlers {
      handle() {}
    }
    OnEvent("test")(
      WithHandlers.prototype,
      "handle",
      Object.getOwnPropertyDescriptor(WithHandlers.prototype, "handle")!,
    );

    class WithoutHandlers {}

    expect(hasEventHandlers(WithHandlers)).toBe(true);
    expect(hasEventHandlers(WithoutHandlers)).toBe(false);
  });

  it("should return empty array for class without handlers", () => {
    class Empty {}
    expect(getEventHandlers(Empty)).toEqual([]);
  });
});

describe("EventModule", () => {
  it("should create a forRoot dynamic module", () => {
    const mod = EventModule.forRoot({ global: true });
    expect(mod.module).toBe(EventModule);
    expect(mod.global).toBe(true);
    expect(mod.exports).toContain("EventBus");
  });

  it("should default to global true", () => {
    const mod = EventModule.forRoot();
    expect(mod.global).toBe(true);
  });

  it("should pass bus options", () => {
    const mod = EventModule.forRoot({
      busOptions: { maxListeners: 10 },
    });
    expect(mod.providers).toBeDefined();
  });
});
