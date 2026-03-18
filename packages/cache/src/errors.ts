// @nexus/cache - Error types

import { NexusError } from "@nexus/core";

/**
 * Base cache error
 */
export class CacheError extends NexusError {
  constructor(message: string, options: { code?: string; cause?: Error } = {}) {
    super(message, { code: options.code ?? "CACHE_ERROR", cause: options.cause });
    this.name = "CacheError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error during serialization/deserialization
 */
export class SerializationError extends CacheError {
  constructor(message: string, options: { cause?: Error } = {}) {
    super(message, { code: "SERIALIZATION_ERROR", ...options });
    this.name = "SerializationError";
  }
}
