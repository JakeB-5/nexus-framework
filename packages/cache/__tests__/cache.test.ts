// @nexus/cache - Comprehensive tests

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  CacheManager,
  MemoryStore,
  NullStore,
  MultiTierStore,
  JsonSerializer,
  BinarySerializer,
  CacheModule,
  CacheError,
  SerializationError,
  generateKey,
  createCacheable,
  createCacheEvict,
  createCachePut,
} from "../src/index.js";

// ============================================================
// MEMORY STORE
// ============================================================
describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ maxSize: 100, purgeInterval: 0, cloneValues: true });
  });

  afterEach(() => {
    store.destroy();
  });

  it("get returns null for missing keys", async () => {
    expect(await store.get("missing")).toBe(null);
  });

  it("set and get a value", async () => {
    await store.set("key", "value");
    expect(await store.get("key")).toBe("value");
  });

  it("set and get objects", async () => {
    await store.set("obj", { name: "Alice", age: 30 });
    expect(await store.get("obj")).toEqual({ name: "Alice", age: 30 });
  });

  it("set and get numbers", async () => {
    await store.set("num", 42);
    expect(await store.get("num")).toBe(42);
  });

  it("set and get arrays", async () => {
    await store.set("arr", [1, 2, 3]);
    expect(await store.get("arr")).toEqual([1, 2, 3]);
  });

  it("clones values to prevent mutation", async () => {
    const obj = { count: 0 };
    await store.set("obj", obj);
    obj.count = 999;
    expect(await store.get<{ count: number }>("obj")).toEqual({ count: 0 });
  });

  it("has() returns true for existing keys", async () => {
    await store.set("key", "val");
    expect(await store.has("key")).toBe(true);
    expect(await store.has("missing")).toBe(false);
  });

  it("delete removes entries", async () => {
    await store.set("key", "val");
    expect(await store.delete("key")).toBe(true);
    expect(await store.get("key")).toBe(null);
    expect(await store.delete("key")).toBe(false);
  });

  it("clear removes all entries", async () => {
    await store.set("a", 1);
    await store.set("b", 2);
    await store.clear();
    expect(await store.size()).toBe(0);
  });

  it("size returns entry count", async () => {
    expect(await store.size()).toBe(0);
    await store.set("a", 1);
    await store.set("b", 2);
    expect(await store.size()).toBe(2);
  });

  it("keys returns all keys", async () => {
    await store.set("a", 1);
    await store.set("b", 2);
    const keys = await store.keys();
    expect(keys.sort()).toEqual(["a", "b"]);
  });

  // TTL
  it("respects TTL expiration", async () => {
    vi.useFakeTimers();
    const ttlStore = new MemoryStore({ purgeInterval: 0 });

    await ttlStore.set("key", "val", 100);
    expect(await ttlStore.get("key")).toBe("val");

    vi.advanceTimersByTime(101);
    expect(await ttlStore.get("key")).toBe(null);

    vi.useRealTimers();
    ttlStore.destroy();
  });

  it("TTL has() returns false after expiry", async () => {
    vi.useFakeTimers();
    const ttlStore = new MemoryStore({ purgeInterval: 0 });

    await ttlStore.set("key", "val", 50);
    expect(await ttlStore.has("key")).toBe(true);

    vi.advanceTimersByTime(51);
    expect(await ttlStore.has("key")).toBe(false);

    vi.useRealTimers();
    ttlStore.destroy();
  });

  it("no TTL means no expiry", async () => {
    vi.useFakeTimers();
    const ttlStore = new MemoryStore({ purgeInterval: 0 });

    await ttlStore.set("key", "val");
    vi.advanceTimersByTime(999999);
    expect(await ttlStore.get("key")).toBe("val");

    vi.useRealTimers();
    ttlStore.destroy();
  });

  // LRU eviction
  it("evicts LRU entry when max size reached", async () => {
    const small = new MemoryStore({ maxSize: 3, purgeInterval: 0 });
    await small.set("a", 1);
    await small.set("b", 2);
    await small.set("c", 3);

    // Access "a" to make it recently used
    await small.get("a");

    // Add new entry, should evict "b" (least recently used)
    await small.set("d", 4);

    expect(await small.has("a")).toBe(true);
    expect(await small.has("b")).toBe(false);
    expect(await small.has("c")).toBe(true);
    expect(await small.has("d")).toBe(true);

    small.destroy();
  });

  it("overwriting existing key does not trigger eviction", async () => {
    const small = new MemoryStore({ maxSize: 2, purgeInterval: 0 });
    await small.set("a", 1);
    await small.set("b", 2);
    await small.set("a", 10); // Overwrite, not new entry

    expect(await small.size()).toBe(2);
    expect(await small.get("a")).toBe(10);
    expect(await small.get("b")).toBe(2);

    small.destroy();
  });

  // Stats
  it("tracks statistics", async () => {
    await store.set("a", 1);
    await store.get("a");       // hit
    await store.get("missing"); // miss
    await store.delete("a");

    const stats = store.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
    expect(stats.deletes).toBe(1);
  });
});

// ============================================================
// NULL STORE
// ============================================================
describe("NullStore", () => {
  it("always returns null", async () => {
    const store = new NullStore();
    await store.set("key", "val");
    expect(await store.get("key")).toBe(null);
  });

  it("has always returns false", async () => {
    const store = new NullStore();
    expect(await store.has("key")).toBe(false);
  });

  it("delete returns false", async () => {
    const store = new NullStore();
    expect(await store.delete("key")).toBe(false);
  });

  it("size is always 0", async () => {
    const store = new NullStore();
    expect(await store.size()).toBe(0);
  });

  it("tracks miss stats", async () => {
    const store = new NullStore();
    await store.get("a");
    await store.get("b");
    expect(store.getStats().misses).toBe(2);
  });
});

// ============================================================
// MULTI-TIER STORE
// ============================================================
describe("MultiTierStore", () => {
  let l1: MemoryStore;
  let l2: MemoryStore;
  let store: MultiTierStore;

  beforeEach(() => {
    l1 = new MemoryStore({ maxSize: 10, purgeInterval: 0 });
    l2 = new MemoryStore({ maxSize: 100, purgeInterval: 0 });
    store = new MultiTierStore(l1, l2);
  });

  afterEach(() => {
    l1.destroy();
    l2.destroy();
  });

  it("reads from L1 first", async () => {
    await l1.set("key", "l1-value");
    await l2.set("key", "l2-value");
    expect(await store.get("key")).toBe("l1-value");
  });

  it("falls through to L2 on L1 miss", async () => {
    await l2.set("key", "l2-value");
    expect(await store.get("key")).toBe("l2-value");
  });

  it("populates L1 on L2 hit (read-through)", async () => {
    await l2.set("key", "l2-value");
    await store.get("key"); // Should populate L1
    expect(await l1.get("key")).toBe("l2-value");
  });

  it("write-through writes to both tiers", async () => {
    await store.set("key", "value");
    expect(await l1.get("key")).toBe("value");
    expect(await l2.get("key")).toBe("value");
  });

  it("delete removes from both tiers", async () => {
    await store.set("key", "value");
    await store.delete("key");
    expect(await l1.has("key")).toBe(false);
    expect(await l2.has("key")).toBe(false);
  });

  it("clear clears both tiers", async () => {
    await store.set("a", 1);
    await store.set("b", 2);
    await store.clear();
    expect(await l1.size()).toBe(0);
    expect(await l2.size()).toBe(0);
  });

  it("has checks both tiers", async () => {
    await l2.set("key", "val");
    expect(await store.has("key")).toBe(true);
  });

  it("keys returns union of both tiers", async () => {
    await l1.set("a", 1);
    await l2.set("b", 2);
    await l2.set("a", 1); // duplicate
    const keys = await store.keys();
    expect(keys.sort()).toEqual(["a", "b"]);
  });

  it("returns null when both miss", async () => {
    expect(await store.get("missing")).toBe(null);
  });
});

// ============================================================
// CACHE MANAGER
// ============================================================
describe("CacheManager", () => {
  let manager: CacheManager;
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ purgeInterval: 0 });
    manager = new CacheManager(store);
  });

  afterEach(() => {
    store.destroy();
  });

  it("get/set basic values", async () => {
    await manager.set("key", "value");
    expect(await manager.get("key")).toBe("value");
  });

  it("get returns null for missing", async () => {
    expect(await manager.get("missing")).toBe(null);
  });

  it("has checks existence", async () => {
    await manager.set("key", "val");
    expect(await manager.has("key")).toBe(true);
    expect(await manager.has("other")).toBe(false);
  });

  it("delete removes entries", async () => {
    await manager.set("key", "val");
    expect(await manager.delete("key")).toBe(true);
    expect(await manager.get("key")).toBe(null);
  });

  it("clear removes all", async () => {
    await manager.set("a", 1);
    await manager.set("b", 2);
    await manager.clear();
    expect(await manager.get("a")).toBe(null);
  });

  it("supports TTL", async () => {
    vi.useFakeTimers();
    await manager.set("key", "val", 100);
    expect(await manager.get("key")).toBe("val");
    vi.advanceTimersByTime(101);
    expect(await manager.get("key")).toBe(null);
    vi.useRealTimers();
  });

  it("uses default TTL", async () => {
    vi.useFakeTimers();
    const mgr = new CacheManager(new MemoryStore({ purgeInterval: 0 }), { defaultTtl: 200 });
    await mgr.set("key", "val");
    vi.advanceTimersByTime(201);
    expect(await mgr.get("key")).toBe(null);
    vi.useRealTimers();
  });

  it("supports prefix/namespace", async () => {
    const mgr = new CacheManager(store, { prefix: "app" });
    await mgr.set("key", "val");
    // The store should have the prefixed key
    expect(await store.get("app:key")).toBe("val");
    expect(await mgr.get("key")).toBe("val");
  });

  // getMany / setMany
  it("getMany returns matching entries", async () => {
    await manager.set("a", 1);
    await manager.set("b", 2);
    const result = await manager.getMany<number>(["a", "b", "c"]);
    expect(result.size).toBe(2);
    expect(result.get("a")).toBe(1);
    expect(result.get("b")).toBe(2);
    expect(result.has("c")).toBe(false);
  });

  it("setMany sets multiple entries", async () => {
    await manager.setMany([
      { key: "x", value: 10 },
      { key: "y", value: 20 },
    ]);
    expect(await manager.get("x")).toBe(10);
    expect(await manager.get("y")).toBe(20);
  });

  // getOrSet (cache-aside)
  it("getOrSet returns cached value", async () => {
    await manager.set("key", "cached");
    const factory = vi.fn(async () => "fresh");
    const result = await manager.getOrSet("key", factory);
    expect(result).toBe("cached");
    expect(factory).not.toHaveBeenCalled();
  });

  it("getOrSet calls factory on miss", async () => {
    const result = await manager.getOrSet("key", async () => "fresh");
    expect(result).toBe("fresh");
    // Value should now be cached
    expect(await manager.get("key")).toBe("fresh");
  });

  it("getOrSet with TTL", async () => {
    vi.useFakeTimers();
    await manager.getOrSet("key", async () => "val", 100);
    expect(await manager.get("key")).toBe("val");
    vi.advanceTimersByTime(101);
    expect(await manager.get("key")).toBe(null);
    vi.useRealTimers();
  });

  // wrap
  it("wrap caches function results", async () => {
    let callCount = 0;
    const fn = async () => { callCount++; return "result"; };

    expect(await manager.wrap("fn-result", fn)).toBe("result");
    expect(await manager.wrap("fn-result", fn)).toBe("result");
    expect(callCount).toBe(1); // Only called once
  });

  // stats
  it("getStats returns statistics", async () => {
    await manager.set("a", 1);
    await manager.get("a");
    await manager.get("b");
    const stats = manager.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
  });

  it("getStore returns underlying store", () => {
    expect(manager.getStore()).toBe(store);
  });
});

// ============================================================
// SERIALIZERS
// ============================================================
describe("JsonSerializer", () => {
  const serializer = new JsonSerializer();

  it("serializes and deserializes strings", () => {
    const data = serializer.serialize("hello");
    expect(serializer.deserialize<string>(data)).toBe("hello");
  });

  it("serializes and deserializes numbers", () => {
    const data = serializer.serialize(42);
    expect(serializer.deserialize<number>(data)).toBe(42);
  });

  it("serializes and deserializes objects", () => {
    const obj = { name: "Alice", items: [1, 2, 3] };
    const data = serializer.serialize(obj);
    expect(serializer.deserialize(data)).toEqual(obj);
  });

  it("serializes null", () => {
    const data = serializer.serialize(null);
    expect(serializer.deserialize(data)).toBe(null);
  });

  it("throws SerializationError on invalid JSON", () => {
    expect(() => serializer.deserialize("not json")).toThrow(SerializationError);
  });

  it("throws SerializationError for circular references", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(() => serializer.serialize(obj)).toThrow(SerializationError);
  });
});

describe("BinarySerializer", () => {
  const serializer = new BinarySerializer();

  it("round-trips strings", () => {
    expect(serializer.deserialize<string>(serializer.serialize("hello"))).toBe("hello");
  });

  it("round-trips numbers", () => {
    expect(serializer.deserialize<number>(serializer.serialize(42))).toBe(42);
  });

  it("round-trips booleans", () => {
    expect(serializer.deserialize<boolean>(serializer.serialize(true))).toBe(true);
    expect(serializer.deserialize<boolean>(serializer.serialize(false))).toBe(false);
  });

  it("round-trips null", () => {
    expect(serializer.deserialize(serializer.serialize(null))).toBe(null);
  });

  it("round-trips undefined", () => {
    expect(serializer.deserialize(serializer.serialize(undefined))).toBe(undefined);
  });

  it("round-trips Date", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    const result = serializer.deserialize<Date>(serializer.serialize(date));
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(date.toISOString());
  });

  it("round-trips arrays", () => {
    expect(serializer.deserialize(serializer.serialize([1, "two", null]))).toEqual([1, "two", null]);
  });

  it("round-trips nested objects", () => {
    const obj = { a: { b: { c: 42 } }, arr: [1, 2] };
    expect(serializer.deserialize(serializer.serialize(obj))).toEqual(obj);
  });
});

// ============================================================
// DECORATORS / KEY GENERATION
// ============================================================
describe("generateKey", () => {
  it("replaces positional placeholders", () => {
    expect(generateKey("user:{0}", ["alice"])).toBe("user:alice");
  });

  it("replaces multiple placeholders", () => {
    expect(generateKey("{0}:{1}", ["users", 42])).toBe("users:42");
  });

  it("handles object arguments", () => {
    const key = generateKey("query:{0}", [{ page: 1 }]);
    expect(key).toContain("page");
  });

  it("leaves unreplaced placeholders", () => {
    expect(generateKey("key:{0}:{1}", ["a"])).toBe("key:a:{1}");
  });
});

describe("Decorator factories", () => {
  let store: MemoryStore;
  let manager: CacheManager;

  beforeEach(() => {
    store = new MemoryStore({ purgeInterval: 0 });
    manager = new CacheManager(store);
  });

  afterEach(() => {
    store.destroy();
  });

  it("createCacheable caches method results", async () => {
    const Cacheable = createCacheable(manager);
    let callCount = 0;

    const obj = {
      async fetchUser(id: number): Promise<string> {
        callCount++;
        return `user-${id}`;
      },
    };

    // Manually apply decorator
    const descriptor: PropertyDescriptor = {
      value: obj.fetchUser,
      writable: true,
      configurable: true,
      enumerable: true,
    };

    const decorated = Cacheable("user:{0}")(obj, "fetchUser", descriptor);
    const method = decorated.value as (id: number) => Promise<string>;

    expect(await method.call(obj, 1)).toBe("user-1");
    expect(await method.call(obj, 1)).toBe("user-1");
    expect(callCount).toBe(1); // Called only once, second was cached
  });

  it("createCacheEvict evicts on method call", async () => {
    const CacheEvict = createCacheEvict(manager);
    await manager.set("user:1", "cached-data");

    const obj = {
      async deleteUser(_id: number): Promise<void> {},
    };

    const descriptor: PropertyDescriptor = {
      value: obj.deleteUser,
      writable: true,
      configurable: true,
      enumerable: true,
    };

    const decorated = CacheEvict("user:{0}")(obj, "deleteUser", descriptor);
    const method = decorated.value as (id: number) => Promise<void>;
    await method.call(obj, 1);

    expect(await manager.get("user:1")).toBe(null);
  });

  it("createCachePut always updates cache", async () => {
    const CachePut = createCachePut(manager);

    const obj = {
      async updateUser(id: number): Promise<string> {
        return `updated-${id}`;
      },
    };

    const descriptor: PropertyDescriptor = {
      value: obj.updateUser,
      writable: true,
      configurable: true,
      enumerable: true,
    };

    const decorated = CachePut("user:{0}")(obj, "updateUser", descriptor);
    const method = decorated.value as (id: number) => Promise<string>;

    const result = await method.call(obj, 1);
    expect(result).toBe("updated-1");
    expect(await manager.get("user:1")).toBe("updated-1");
  });
});

// ============================================================
// CACHE MODULE
// ============================================================
describe("CacheModule", () => {
  it("createMemory creates memory-backed manager", async () => {
    const mgr = CacheModule.createMemory();
    await mgr.set("key", "val");
    expect(await mgr.get("key")).toBe("val");
  });

  it("createNull creates disabled cache", async () => {
    const mgr = CacheModule.createNull();
    await mgr.set("key", "val");
    expect(await mgr.get("key")).toBe(null);
  });

  it("createMultiTier creates tiered cache", async () => {
    const l1 = new MemoryStore({ maxSize: 10, purgeInterval: 0 });
    const l2 = new MemoryStore({ maxSize: 100, purgeInterval: 0 });
    const mgr = CacheModule.createMultiTier(l1, l2);

    await mgr.set("key", "val");
    expect(await mgr.get("key")).toBe("val");
    expect(await l1.get("key")).toBe("val");
    expect(await l2.get("key")).toBe("val");

    l1.destroy();
    l2.destroy();
  });

  it("createMemory with options", async () => {
    const mgr = CacheModule.createMemory({
      storeOptions: { maxSize: 5 },
      cacheOptions: { prefix: "test" },
    });
    await mgr.set("key", "val");
    expect(await mgr.get("key")).toBe("val");
  });
});

// ============================================================
// ERRORS
// ============================================================
describe("Cache Errors", () => {
  it("CacheError has correct properties", () => {
    const err = new CacheError("test error");
    expect(err.name).toBe("CacheError");
    expect(err.code).toBe("CACHE_ERROR");
    expect(err.message).toBe("test error");
  });

  it("SerializationError has correct code", () => {
    const err = new SerializationError("bad data");
    expect(err.name).toBe("SerializationError");
    expect(err.code).toBe("SERIALIZATION_ERROR");
  });
});
