// @nexus/cache - Error types

/**
 * Base cache error
 */
export class CacheError extends Error {
  public readonly code: string;

  constructor(message: string, options: { code?: string; cause?: Error } = {}) {
    super(message);
    this.name = "CacheError";
    this.code = options.code ?? "CACHE_ERROR";
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
