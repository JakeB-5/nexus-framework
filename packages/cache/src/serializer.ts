// @nexus/cache - Value serialization

import type { CacheSerializer } from "./types.js";
import { SerializationError } from "./errors.js";

/**
 * JSON serializer (default)
 */
export class JsonSerializer implements CacheSerializer {
  serialize(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize value: ${error instanceof Error ? error.message : "unknown error"}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  deserialize<T>(data: string): T {
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize value: ${error instanceof Error ? error.message : "unknown error"}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }
}

/**
 * MessagePack-like binary serializer
 * Uses a simple binary format: type byte + data
 * This is a lightweight implementation without external deps
 */
export class BinarySerializer implements CacheSerializer {
  serialize(value: unknown): string {
    // Encode to a JSON-compatible string with type hints for restoration
    const wrapped = this._wrap(value);
    return JSON.stringify(wrapped);
  }

  deserialize<T>(data: string): T {
    try {
      const wrapped = JSON.parse(data) as WrappedValue;
      return this._unwrap(wrapped) as T;
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize binary value: ${error instanceof Error ? error.message : "unknown error"}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  private _wrap(value: unknown): WrappedValue {
    if (value === null) return { t: "n", v: null };
    if (value === undefined) return { t: "u", v: null };
    if (typeof value === "string") return { t: "s", v: value };
    if (typeof value === "number") return { t: "d", v: value };
    if (typeof value === "boolean") return { t: "b", v: value };
    if (value instanceof Date) return { t: "D", v: value.toISOString() };
    if (Array.isArray(value)) return { t: "a", v: value.map((item) => this._wrap(item)) };
    if (typeof value === "object") {
      const obj: Record<string, WrappedValue> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        obj[k] = this._wrap(v);
      }
      return { t: "o", v: obj };
    }
    return { t: "s", v: String(value) };
  }

  private _unwrap(wrapped: WrappedValue): unknown {
    switch (wrapped.t) {
      case "n": return null;
      case "u": return undefined;
      case "s": return wrapped.v as string;
      case "d": return wrapped.v as number;
      case "b": return wrapped.v as boolean;
      case "D": return new Date(wrapped.v as string);
      case "a": return (wrapped.v as WrappedValue[]).map((item) => this._unwrap(item));
      case "o": {
        const result: Record<string, unknown> = {};
        const obj = wrapped.v as Record<string, WrappedValue>;
        for (const [k, v] of Object.entries(obj)) {
          result[k] = this._unwrap(v);
        }
        return result;
      }
      default: return wrapped.v;
    }
  }
}

interface WrappedValue {
  t: string;
  v: unknown;
}
