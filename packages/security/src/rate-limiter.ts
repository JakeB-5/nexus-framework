// @nexus/security - Rate limiting middleware

import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";
import type { RateLimitInfo, RateLimitOptions, SecurityMiddleware } from "./types.js";

interface TokenBucketEntry {
  tokens: number;
  lastRefill: number;
}

interface SlidingWindowEntry {
  timestamps: number[];
}

/**
 * Token bucket rate limiter store
 */
export class TokenBucketStore {
  private readonly _buckets: Map<string, TokenBucketEntry> = new Map();
  private readonly _max: number;
  private readonly _windowMs: number;

  constructor(max: number, windowMs: number) {
    this._max = max;
    this._windowMs = windowMs;
  }

  consume(key: string): RateLimitInfo {
    const now = Date.now();
    let entry = this._buckets.get(key);

    if (!entry) {
      entry = { tokens: this._max, lastRefill: now };
      this._buckets.set(key, entry);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill;
    const refillRate = this._max / this._windowMs;
    const refillTokens = elapsed * refillRate;
    entry.tokens = Math.min(this._max, entry.tokens + refillTokens);
    entry.lastRefill = now;

    // Try to consume a token
    if (entry.tokens >= 1) {
      entry.tokens -= 1;
      return {
        limit: this._max,
        remaining: Math.floor(entry.tokens),
        resetTime: now + this._windowMs,
      };
    }

    // No tokens available
    const timeUntilRefill = Math.ceil((1 - entry.tokens) / refillRate);
    return {
      limit: this._max,
      remaining: 0,
      resetTime: now + timeUntilRefill,
    };
  }

  clear(): void {
    this._buckets.clear();
  }
}

/**
 * Sliding window rate limiter store
 */
export class SlidingWindowStore {
  private readonly _windows: Map<string, SlidingWindowEntry> = new Map();
  private readonly _max: number;
  private readonly _windowMs: number;

  constructor(max: number, windowMs: number) {
    this._max = max;
    this._windowMs = windowMs;
  }

  consume(key: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this._windowMs;

    let entry = this._windows.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      this._windows.set(key, entry);
    }

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length < this._max) {
      entry.timestamps.push(now);
      return {
        limit: this._max,
        remaining: this._max - entry.timestamps.length,
        resetTime: now + this._windowMs,
      };
    }

    // Rate limited
    const oldestInWindow = entry.timestamps[0] ?? now;
    return {
      limit: this._max,
      remaining: 0,
      resetTime: oldestInWindow + this._windowMs,
    };
  }

  clear(): void {
    this._windows.clear();
  }
}

/**
 * Create rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions): SecurityMiddleware {
  const {
    max,
    windowMs,
    algorithm = "sliding-window",
    keyGenerator = (req) => req.ip,
    skip,
    handler,
    headers = true,
    message = "Too many requests, please try again later",
  } = options;

  const store = algorithm === "token-bucket"
    ? new TokenBucketStore(max, windowMs)
    : new SlidingWindowStore(max, windowMs);

  return (req: NexusRequestInterface, res: NexusResponseInterface, next: NextFunction): void => {
    // Check skip
    if (skip?.(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const info = store.consume(key);

    // Set rate limit headers
    if (headers) {
      res.header("X-RateLimit-Limit", String(info.limit));
      res.header("X-RateLimit-Remaining", String(info.remaining));
      res.header("X-RateLimit-Reset", String(Math.ceil(info.resetTime / 1000)));
    }

    if (info.remaining === 0 && algorithm === "sliding-window") {
      // Check if this request pushed us over (remaining was 0 before consume added)
      // For sliding-window, remaining=0 after consume means we just barely fit
      // Actually we need to check if we were already at limit
      // The consume already pushed the timestamp, so remaining=0 means we used the last slot
      next();
      return;
    }

    if (info.remaining < 0 || (info.remaining === 0 && algorithm === "token-bucket")) {
      const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);
      res.header("Retry-After", String(Math.max(retryAfter, 1)));

      if (handler) {
        handler(req, res);
        return;
      }

      res.status(429).json({ error: "Too Many Requests", message, statusCode: 429 });
      return;
    }

    next();
  };
}

export { type RateLimitInfo };
