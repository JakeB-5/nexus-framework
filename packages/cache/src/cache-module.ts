// @nexus/cache - Module integration

import { CacheManager } from "./cache-manager.js";
import { MemoryStore } from "./stores/memory-store.js";
import { NullStore } from "./stores/null-store.js";
import { MultiTierStore } from "./stores/multi-tier-store.js";
import type { CacheStore } from "./stores/store.js";
import type { CacheOptions, StoreOptions } from "./types.js";
import type { WriteStrategy } from "./stores/multi-tier-store.js";

/**
 * Cache module configuration
 */
export interface CacheModuleOptions {
  /** Default store type */
  store?: "memory" | "null";
  /** Store-specific options */
  storeOptions?: StoreOptions;
  /** Cache options (prefix, ttl) */
  cacheOptions?: CacheOptions;
}

/**
 * Cache module - factory for creating cache managers
 */
export class CacheModule {
  /**
   * Create a CacheManager with a memory store
   */
  static createMemory(options: {
    storeOptions?: StoreOptions;
    cacheOptions?: CacheOptions;
  } = {}): CacheManager {
    const store = new MemoryStore(options.storeOptions);
    return new CacheManager(store, options.cacheOptions);
  }

  /**
   * Create a CacheManager with a null store (disabled cache)
   */
  static createNull(cacheOptions?: CacheOptions): CacheManager {
    return new CacheManager(new NullStore(), cacheOptions);
  }

  /**
   * Create a multi-tier cache manager
   */
  static createMultiTier(
    l1: CacheStore,
    l2: CacheStore,
    options: {
      writeStrategy?: WriteStrategy;
      cacheOptions?: CacheOptions;
    } = {},
  ): CacheManager {
    const store = new MultiTierStore(l1, l2, {
      writeStrategy: options.writeStrategy,
    });
    return new CacheManager(store, options.cacheOptions);
  }
}
