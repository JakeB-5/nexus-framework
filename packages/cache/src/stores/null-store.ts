// @nexus/cache - No-op cache store for testing

import { CacheStore } from "./store.js";
import type { CacheStats } from "../types.js";

/**
 * Null store - never stores anything, always misses.
 * Useful for testing and disabling cache.
 */
export class NullStore extends CacheStore {
  private _stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 };

  async get<T>(_key: string): Promise<T | null> {
    this._stats.misses++;
    return null;
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {
    this._stats.sets++;
  }

  async has(_key: string): Promise<boolean> {
    return false;
  }

  async delete(_key: string): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {
    // no-op
  }

  async size(): Promise<number> {
    return 0;
  }

  async keys(): Promise<string[]> {
    return [];
  }

  getStats(): CacheStats {
    return { ...this._stats };
  }
}
