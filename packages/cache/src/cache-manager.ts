// @nexus/cache - CacheManager class

import type { CacheStore } from "./stores/store.js";
import type { CacheOptions, CacheStats } from "./types.js";

/**
 * CacheManager - main API for cache operations.
 * Wraps a store with namespace/prefix support and stats tracking.
 */
export class CacheManager {
  private readonly _store: CacheStore;
  private readonly _prefix: string;
  private readonly _defaultTtl: number | undefined;

  constructor(store: CacheStore, options: CacheOptions = {}) {
    this._store = store;
    this._prefix = options.prefix ? `${options.prefix}:` : "";
    this._defaultTtl = options.defaultTtl;
  }

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    return this._store.get<T>(this._prefixKey(key));
  }

  /**
   * Set a cached value with optional TTL (in milliseconds)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this._defaultTtl;
    await this._store.set(this._prefixKey(key), value, effectiveTtl);
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    return this._store.has(this._prefixKey(key));
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<boolean> {
    return this._store.delete(this._prefixKey(key));
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    await this._store.clear();
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    // Run in parallel for performance
    const entries = await Promise.all(
      keys.map(async (key) => {
        const value = await this._store.get<T>(this._prefixKey(key));
        return [key, value] as [string, T | null];
      }),
    );

    for (const [key, value] of entries) {
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(entries: Array<{ key: string; value: T }>, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this._defaultTtl;
    await Promise.all(
      entries.map(({ key, value }) =>
        this._store.set(this._prefixKey(key), value, effectiveTtl),
      ),
    );
  }

  /**
   * Get or set pattern (cache-aside)
   * Returns cached value if exists, otherwise calls factory and caches result
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Wrap a function with caching
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    return this.getOrSet(key, fn, ttl);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this._store.getStats();
  }

  /**
   * Get the underlying store
   */
  getStore(): CacheStore {
    return this._store;
  }

  private _prefixKey(key: string): string {
    return `${this._prefix}${key}`;
  }
}
