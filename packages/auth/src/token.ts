// Token utilities - secure random tokens, API keys, revocation

import { randomBytes } from "node:crypto";
import type { ApiKeyOptions, TokenOptions } from "./types.js";

const DEFAULT_TOKEN_LENGTH = 32;
const DEFAULT_API_KEY_LENGTH = 32;
const DEFAULT_API_KEY_PREFIX = "nxs";

export function generateToken(options: TokenOptions = {}): string {
  const { prefix, length = DEFAULT_TOKEN_LENGTH } = options;
  const token = randomBytes(length).toString("hex");
  return prefix ? `${prefix}_${token}` : token;
}

export function generateApiKey(options: ApiKeyOptions = {}): string {
  const {
    prefix = DEFAULT_API_KEY_PREFIX,
    length = DEFAULT_API_KEY_LENGTH,
  } = options;
  const key = randomBytes(length).toString("base64url");
  return `${prefix}_${key}`;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export class TokenBlacklist {
  private readonly blacklist = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  constructor(cleanupIntervalMs = 60_000) {
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  revoke(token: string, expiresAt?: number): void {
    // Store the token with its expiry so we can clean up later
    const expiry = expiresAt ?? Date.now() + 24 * 60 * 60 * 1000; // default 24h
    this.blacklist.set(token, expiry);
  }

  isRevoked(token: string): boolean {
    const expiry = this.blacklist.get(token);
    if (expiry === undefined) {
      return false;
    }

    // If the blacklist entry itself has expired, clean it up
    if (Date.now() > expiry) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  size(): number {
    return this.blacklist.size;
  }

  clear(): void {
    this.blacklist.clear();
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [token, expiry] of this.blacklist) {
      if (now > expiry) {
        this.blacklist.delete(token);
        removed++;
      }
    }
    return removed;
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.blacklist.clear();
  }
}

export class RefreshTokenStore {
  private readonly tokens = new Map<
    string,
    { userId: string; expiresAt: number; family: string }
  >();

  store(
    token: string,
    userId: string,
    expiresAt: number,
    family?: string,
  ): void {
    this.tokens.set(token, {
      userId,
      expiresAt,
      family: family ?? token,
    });
  }

  validate(token: string): { userId: string; family: string } | undefined {
    const entry = this.tokens.get(token);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(token);
      return undefined;
    }

    return { userId: entry.userId, family: entry.family };
  }

  consume(token: string): { userId: string; family: string } | undefined {
    const result = this.validate(token);
    if (result) {
      this.tokens.delete(token);
    }
    return result;
  }

  revokeFamily(family: string): number {
    let count = 0;
    for (const [token, entry] of this.tokens) {
      if (entry.family === family) {
        this.tokens.delete(token);
        count++;
      }
    }
    return count;
  }

  revokeUser(userId: string): number {
    let count = 0;
    for (const [token, entry] of this.tokens) {
      if (entry.userId === userId) {
        this.tokens.delete(token);
        count++;
      }
    }
    return count;
  }

  size(): number {
    return this.tokens.size;
  }

  clear(): void {
    this.tokens.clear();
  }
}
