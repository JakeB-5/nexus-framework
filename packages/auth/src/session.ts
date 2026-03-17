// Session management

import { randomBytes } from "node:crypto";
import { MemorySessionStore, type SessionStore } from "./session-store.js";
import type {
  CookieOptions,
  Session,
  SessionData,
  SessionManagerOptions,
} from "./types.js";

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_COOKIE_NAME = "nexus.sid";

function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

function formatCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const parts = [`${name}=${value}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.sameSite) {
    parts.push(
      `SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`,
    );
  }

  return parts.join("; ");
}

export class SessionManager<T extends SessionData = SessionData> {
  private readonly store: SessionStore<T>;
  private readonly ttl: number;
  private readonly slidingExpiration: boolean;
  private readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  private readonly generateId: () => string;

  constructor(
    options: SessionManagerOptions = {},
    store?: SessionStore<T>,
  ) {
    this.store = store ?? (new MemorySessionStore<T>() as SessionStore<T>);
    this.ttl = options.ttl ?? DEFAULT_TTL;
    this.slidingExpiration = options.slidingExpiration ?? true;
    this.cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
    this.cookieOptions = options.cookieOptions ?? {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    };
    this.generateId = options.generateId ?? generateSessionId;
  }

  async create(data: T = {} as T): Promise<Session<T>> {
    const now = Date.now();
    const session: Session<T> = {
      id: this.generateId(),
      data,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.ttl,
    };

    await this.store.set(session.id, session);
    return session;
  }

  async get(id: string): Promise<Session<T> | undefined> {
    const session = await this.store.get(id);
    if (!session) {
      return undefined;
    }

    if (this.slidingExpiration) {
      const newExpiresAt = Date.now() + this.ttl;
      await this.store.touch(id, newExpiresAt);
      session.expiresAt = newExpiresAt;
      session.updatedAt = Date.now();
    }

    return session;
  }

  async update(id: string, data: Partial<T>): Promise<Session<T> | undefined> {
    const session = await this.store.get(id);
    if (!session) {
      return undefined;
    }

    session.data = { ...session.data, ...data };
    session.updatedAt = Date.now();

    if (this.slidingExpiration) {
      session.expiresAt = Date.now() + this.ttl;
    }

    await this.store.set(id, session);
    return session;
  }

  async destroy(id: string): Promise<boolean> {
    return this.store.destroy(id);
  }

  async exists(id: string): Promise<boolean> {
    const session = await this.store.get(id);
    return session !== undefined;
  }

  getCookieName(): string {
    return this.cookieName;
  }

  formatSetCookie(sessionId: string): string {
    return formatCookie(this.cookieName, sessionId, {
      ...this.cookieOptions,
      maxAge: Math.floor(this.ttl / 1000),
    });
  }

  formatClearCookie(): string {
    return formatCookie(this.cookieName, "", {
      ...this.cookieOptions,
      maxAge: 0,
    });
  }

  parseCookieHeader(cookieHeader: string): string | undefined {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.split("=");
      if (name.trim() === this.cookieName) {
        return valueParts.join("=").trim();
      }
    }
    return undefined;
  }

  getStore(): SessionStore<T> {
    return this.store;
  }
}
