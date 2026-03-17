// @nexus/cache - Caching decorators

import type { CacheManager } from "./cache-manager.js";

/**
 * Key generator - creates cache keys from method arguments
 */
export function generateKey(template: string, args: unknown[]): string {
  let key = template;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const replacement = typeof arg === "object" ? JSON.stringify(arg) : String(arg);
    key = key.replace(`{${i}}`, replacement);
  }
  return key;
}

/**
 * Create a @Cacheable decorator factory
 * Caches the method result using the generated key
 */
export function createCacheable(cacheManager: CacheManager) {
  return function Cacheable(keyTemplate: string, ttl?: number) {
    return function <T extends Record<string, unknown>>(
      _target: T,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

      descriptor.value = async function (this: unknown, ...args: unknown[]) {
        const key = generateKey(keyTemplate, args);
        const cached = await cacheManager.get(key);
        if (cached !== null) {
          return cached;
        }
        const result = await originalMethod.apply(this, args);
        await cacheManager.set(key, result, ttl);
        return result;
      };

      Object.defineProperty(descriptor.value, "name", { value: propertyKey });
      return descriptor;
    };
  };
}

/**
 * Create a @CacheEvict decorator factory
 * Evicts the cache entry when the method is called
 */
export function createCacheEvict(cacheManager: CacheManager) {
  return function CacheEvict(keyTemplate: string) {
    return function <T extends Record<string, unknown>>(
      _target: T,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

      descriptor.value = async function (this: unknown, ...args: unknown[]) {
        const key = generateKey(keyTemplate, args);
        await cacheManager.delete(key);
        return originalMethod.apply(this, args);
      };

      Object.defineProperty(descriptor.value, "name", { value: propertyKey });
      return descriptor;
    };
  };
}

/**
 * Create a @CachePut decorator factory
 * Always executes the method and updates the cache
 */
export function createCachePut(cacheManager: CacheManager) {
  return function CachePut(keyTemplate: string, ttl?: number) {
    return function <T extends Record<string, unknown>>(
      _target: T,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
      const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

      descriptor.value = async function (this: unknown, ...args: unknown[]) {
        const result = await originalMethod.apply(this, args);
        const key = generateKey(keyTemplate, args);
        await cacheManager.set(key, result, ttl);
        return result;
      };

      Object.defineProperty(descriptor.value, "name", { value: propertyKey });
      return descriptor;
    };
  };
}
