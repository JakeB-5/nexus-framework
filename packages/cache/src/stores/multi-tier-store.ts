// @nexus/cache - Multi-tier cache store (L1 memory + L2)

import { CacheStore } from "./store.js";
import type { CacheStats } from "../types.js";

/**
 * Write strategy for multi-tier cache
 */
export type WriteStrategy = "write-through" | "write-behind";

/**
 * Multi-tier cache store
 * Reads from L1 first, falls through to L2.
 * Writes go to both tiers based on strategy.
 */
export class MultiTierStore extends CacheStore {
  private readonly _writeStrategy: WriteStrategy;

  constructor(
    private readonly _l1: CacheStore,
    private readonly _l2: CacheStore,
    options: { writeStrategy?: WriteStrategy } = {},
  ) {
    super();
    this._writeStrategy = options.writeStrategy ?? "write-through";
  }

  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    const l1Value = await this._l1.get<T>(key);
    if (l1Value !== null) {
      return l1Value;
    }

    // Fall through to L2
    const l2Value = await this._l2.get<T>(key);
    if (l2Value !== null) {
      // Populate L1 with value from L2 (read-through)
      await this._l1.set(key, l2Value);
      return l2Value;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (this._writeStrategy === "write-through") {
      // Write to both immediately
      await Promise.all([
        this._l1.set(key, value, ttl),
        this._l2.set(key, value, ttl),
      ]);
    } else {
      // Write to L1 immediately, L2 asynchronously
      await this._l1.set(key, value, ttl);
      // Fire and forget for write-behind
      void this._l2.set(key, value, ttl);
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this._l1.has(key)) || (await this._l2.has(key));
  }

  async delete(key: string): Promise<boolean> {
    const [l1, l2] = await Promise.all([
      this._l1.delete(key),
      this._l2.delete(key),
    ]);
    return l1 || l2;
  }

  async clear(): Promise<void> {
    await Promise.all([this._l1.clear(), this._l2.clear()]);
  }

  async size(): Promise<number> {
    // Return L2 size as authoritative
    return this._l2.size();
  }

  async keys(): Promise<string[]> {
    // Union of keys from both tiers
    const [l1Keys, l2Keys] = await Promise.all([
      this._l1.keys(),
      this._l2.keys(),
    ]);
    return [...new Set([...l1Keys, ...l2Keys])];
  }

  getStats(): CacheStats {
    const l1Stats = this._l1.getStats();
    const l2Stats = this._l2.getStats();
    return {
      hits: l1Stats.hits + l2Stats.hits,
      misses: l1Stats.misses,
      sets: l1Stats.sets,
      deletes: l1Stats.deletes,
      size: l2Stats.size,
    };
  }
}
