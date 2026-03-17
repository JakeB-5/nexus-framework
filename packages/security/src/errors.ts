// @nexus/security - Error types

/**
 * Base security error
 */
export class SecurityError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, options: { code?: string; statusCode?: number; cause?: Error } = {}) {
    super(message);
    this.name = "SecurityError";
    this.code = options.code ?? "SECURITY_ERROR";
    this.statusCode = options.statusCode ?? 403;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * CORS origin rejected
 */
export class CorsError extends SecurityError {
  constructor(origin: string) {
    super(`Origin "${origin}" not allowed by CORS policy`, {
      code: "CORS_ORIGIN_DENIED",
      statusCode: 403,
    });
    this.name = "CorsError";
  }
}

/**
 * CSRF token missing or invalid
 */
export class CsrfError extends SecurityError {
  constructor(message = "CSRF token validation failed") {
    super(message, {
      code: "CSRF_TOKEN_INVALID",
      statusCode: 403,
    });
    this.name = "CsrfError";
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends SecurityError {
  public readonly retryAfter: number;

  constructor(retryAfterMs: number) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    super(`Rate limit exceeded. Retry after ${retryAfterSec} seconds`, {
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
    });
    this.name = "RateLimitError";
    this.retryAfter = retryAfterSec;
  }
}

/**
 * IP address denied
 */
export class IpDeniedError extends SecurityError {
  public readonly ip: string;

  constructor(ip: string) {
    super(`IP address "${ip}" denied`, {
      code: "IP_DENIED",
      statusCode: 403,
    });
    this.name = "IpDeniedError";
    this.ip = ip;
  }
}
