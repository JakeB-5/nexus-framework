// @nexus/cache - Type definitions

/**
 * Cache options for the manager
 */
export interface CacheOptions {
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Key prefix for namespacing */
  prefix?: string;
}

/**
 * Store-specific options
 */
export interface StoreOptions {
  /** Maximum number of entries for memory stores */
  maxSize?: number;
  /** Check interval for expired entries (ms) */
  purgeInterval?: number;
  /** Whether to clone values on get/set */
  cloneValues?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null; // null = no expiry
  createdAt: number;
}

/**
 * Serializer interface
 */
export interface CacheSerializer {
  serialize(value: unknown): string;
  deserialize<T>(data: string): T;
}
