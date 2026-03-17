// @nexus/config - ConfigService implementation

import type { ConfigLoader, ConfigSchema } from "./types.js";
import { ConfigNotFoundError } from "./errors.js";
import { assertConfigValid, extractDefaults } from "./schema.js";

/**
 * Type-safe configuration service.
 *
 * Supports layered config: defaults → loaders (file, env) → runtime overrides.
 * Provides dot-notation path access, type coercion, and schema validation.
 */
export class ConfigService {
  private config: Record<string, unknown> = {};
  private readonly schema: ConfigSchema | undefined;

  constructor(options?: { schema?: ConfigSchema }) {
    this.schema = options?.schema;
  }

  /**
   * Load configuration from all loaders in order.
   * Later loaders override earlier ones.
   */
  async loadFrom(
    defaults: Record<string, unknown>,
    loaders: ConfigLoader[],
  ): Promise<void> {
    // Start with schema defaults
    let merged: Record<string, unknown> = {};
    if (this.schema) {
      merged = extractDefaults(this.schema);
    }

    // Apply user-provided defaults
    merged = deepMerge(merged, defaults);

    // Apply loaders in order (later loaders override earlier)
    for (const loader of loaders) {
      const loaded = await loader.load();
      merged = deepMerge(merged, loaded);
    }

    this.config = merged;

    // Validate if schema is provided
    if (this.schema) {
      assertConfigValid(this.config, this.schema);
    }
  }

  /**
   * Get a configuration value by dot-notation path.
   * Returns the value or the default value if not found.
   */
  get<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.getByPath(key);
    if (value === undefined) {
      return defaultValue as T;
    }
    return value as T;
  }

  /**
   * Get a configuration value by dot-notation path.
   * Throws ConfigNotFoundError if the key doesn't exist.
   */
  getOrThrow<T = unknown>(key: string): T {
    const value = this.getByPath(key);
    if (value === undefined) {
      throw new ConfigNotFoundError(key);
    }
    return value as T;
  }

  /**
   * Check if a configuration key exists.
   */
  has(key: string): boolean {
    return this.getByPath(key) !== undefined;
  }

  /**
   * Set a runtime override for a configuration key.
   */
  set(key: string, value: unknown): void {
    this.setByPath(key, value);
  }

  /**
   * Get the entire configuration object.
   */
  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Merge additional configuration into the current config.
   */
  merge(additional: Record<string, unknown>): void {
    this.config = deepMerge(this.config, additional);
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private getByPath(key: string): unknown {
    const parts = key.split(".");
    let current: unknown = this.config;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private setByPath(key: string, value: unknown): void {
    const parts = key.split(".");
    let current = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        current[part] === undefined ||
        typeof current[part] !== "object" ||
        current[part] === null
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }
}

/**
 * Deep merge two objects. Source overrides target. Arrays are replaced.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];

    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
