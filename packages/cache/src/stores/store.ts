// @nexus/cache - CacheStore interface and base class

import type { CacheStats } from "../types.js";

/**
 * Abstract cache store interface
 */
export abstract class CacheStore {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract has(key: string): Promise<boolean>;
  abstract delete(key: string): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract size(): Promise<number>;
  abstract keys(): Promise<string[]>;
  abstract getStats(): CacheStats;
}
