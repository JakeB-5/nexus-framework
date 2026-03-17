// Session store interface and in-memory implementation

import type { Session, SessionData } from "./types.js";

export abstract class SessionStore<T extends SessionData = SessionData> {
  abstract get(id: string): Promise<Session<T> | undefined>;
  abstract set(id: string, session: Session<T>): Promise<void>;
  abstract destroy(id: string): Promise<boolean>;
  abstract touch(id: string, expiresAt: number): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract size(): Promise<number>;
}

export class MemorySessionStore<
  T extends SessionData = SessionData,
> extends SessionStore<T> {
  private readonly sessions = new Map<string, Session<T>>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  constructor(cleanupIntervalMs = 60_000) {
    super();
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
      // Allow process to exit even if timer is running
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  async get(id: string): Promise<Session<T> | undefined> {
    const session = this.sessions.get(id);
    if (!session) {
      return undefined;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return undefined;
    }

    return session;
  }

  async set(id: string, session: Session<T>): Promise<void> {
    this.sessions.set(id, session);
  }

  async destroy(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async touch(id: string, expiresAt: number): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return false;
    }

    session.expiresAt = expiresAt;
    session.updatedAt = Date.now();
    return true;
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }

  async size(): Promise<number> {
    return this.sessions.size;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
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
    this.sessions.clear();
  }
}
