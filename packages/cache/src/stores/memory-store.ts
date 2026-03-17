// @nexus/cache - In-memory LRU cache store

import { CacheStore } from "./store.js";
import type { CacheStats, CacheEntry } from "../types.js";

/**
 * In-memory cache store with LRU eviction and TTL support
 */
export class MemoryStore extends CacheStore {
  private readonly _entries: Map<string, CacheEntry<unknown>> = new Map();
  private readonly _accessOrder: Map<string, number> = new Map();
  private readonly _maxSize: number;
  private readonly _cloneValues: boolean;
  private _accessCounter = 0;
  private _stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 };
  private _purgeTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: { maxSize?: number; purgeInterval?: number; cloneValues?: boolean } = {}) {
    super();
    this._maxSize = options.maxSize ?? 1000;
    this._cloneValues = options.cloneValues ?? true;

    // Set up periodic purge of expired entries
    const interval = options.purgeInterval ?? 60000;
    if (interval > 0) {
      this._purgeTimer = setInterval(() => { this._purgeExpired(); }, interval);
      // Allow the process to exit even if timer is active
      if (this._purgeTimer && typeof this._purgeTimer === "object" && "unref" in this._purgeTimer) {
        this._purgeTimer.unref();
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this._entries.get(key);
    if (!entry) {
      this._stats.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this._entries.delete(key);
      this._accessOrder.delete(key);
      this._stats.size = this._entries.size;
      this._stats.misses++;
      return null;
    }

    // Update access order for LRU
    this._accessOrder.set(key, ++this._accessCounter);
    this._stats.hits++;

    return (this._cloneValues ? structuredClone(entry.value) : entry.value) as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Evict if at capacity and key is new
    if (!this._entries.has(key) && this._entries.size >= this._maxSize) {
      this._evictLru();
    }

    const storedValue = this._cloneValues ? structuredClone(value) : value;
    const entry: CacheEntry<unknown> = {
      value: storedValue,
      expiresAt: ttl !== undefined ? Date.now() + ttl : null,
      createdAt: Date.now(),
    };

    this._entries.set(key, entry);
    this._accessOrder.set(key, ++this._accessCounter);
    this._stats.sets++;
    this._stats.size = this._entries.size;
  }

  async has(key: string): Promise<boolean> {
    const entry = this._entries.get(key);
    if (!entry) return false;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this._entries.delete(key);
      this._accessOrder.delete(key);
      this._stats.size = this._entries.size;
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this._entries.delete(key);
    this._accessOrder.delete(key);
    if (existed) {
      this._stats.deletes++;
      this._stats.size = this._entries.size;
    }
    return existed;
  }

  async clear(): Promise<void> {
    this._entries.clear();
    this._accessOrder.clear();
    this._stats.size = 0;
  }

  async size(): Promise<number> {
    return this._entries.size;
  }

  async keys(): Promise<string[]> {
    return [...this._entries.keys()];
  }

  getStats(): CacheStats {
    return { ...this._stats };
  }

  /**
   * Stop the purge timer
   */
  destroy(): void {
    if (this._purgeTimer) {
      clearInterval(this._purgeTimer);
      this._purgeTimer = undefined;
    }
  }

  /**
   * Evict the least recently used entry
   */
  private _evictLru(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, access] of this._accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._entries.delete(oldestKey);
      this._accessOrder.delete(oldestKey);
      this._stats.size = this._entries.size;
    }
  }

  /**
   * Remove all expired entries
   */
  private _purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this._entries) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this._entries.delete(key);
        this._accessOrder.delete(key);
      }
    }
    this._stats.size = this._entries.size;
  }
}
