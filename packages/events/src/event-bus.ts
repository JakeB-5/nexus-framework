// @nexus/events - EventBus implementation

import type {
  EventHandler,
  EventSubscription,
  EventSubscriptionOptions,
  EventBusOptions,
} from "./types.js";
import { EventTimeoutError } from "./errors.js";

/**
 * Async-capable event bus with typed events, wildcard support,
 * priority ordering, and error isolation per handler.
 */
export class EventBus {
  private subscriptions = new Map<string, EventSubscription[]>();
  private readonly maxListeners: number;

  constructor(options: EventBusOptions = {}) {
    this.maxListeners = options.maxListeners ?? 0;
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   *
   * Supports wildcard patterns:
   * - `*` matches all events
   * - `user.*` matches `user.created`, `user.deleted`, etc.
   */
  on<T = unknown>(
    event: string,
    handler: EventHandler<T>,
    options?: EventSubscriptionOptions,
  ): () => void {
    const subscription: EventSubscription<T> = {
      handler,
      priority: options?.priority ?? 100,
      once: false,
      label: options?.label,
    };

    this.addSubscription(event, subscription as EventSubscription);

    return () => {
      this.removeSubscription(event, subscription as EventSubscription);
    };
  }

  /**
   * Subscribe to an event for a single emission only.
   */
  once<T = unknown>(
    event: string,
    handler: EventHandler<T>,
    options?: EventSubscriptionOptions,
  ): () => void {
    const subscription: EventSubscription<T> = {
      handler,
      priority: options?.priority ?? 100,
      once: true,
      label: options?.label,
    };

    this.addSubscription(event, subscription as EventSubscription);

    return () => {
      this.removeSubscription(event, subscription as EventSubscription);
    };
  }

  /**
   * Explicitly unsubscribe a handler from an event.
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const subs = this.subscriptions.get(event);
    if (!subs) return;

    const idx = subs.findIndex((s) => s.handler === handler);
    if (idx !== -1) {
      subs.splice(idx, 1);
      if (subs.length === 0) {
        this.subscriptions.delete(event);
      }
    }
  }

  /**
   * Emit an event to all matching subscribers.
   * Handlers run in priority order. Each handler's errors are isolated -
   * one failing handler doesn't prevent others from running.
   *
   * Returns an array of errors from failed handlers (empty if all succeeded).
   */
  async emit<T = unknown>(event: string, data: T): Promise<Error[]> {
    const handlers = this.getMatchingSubscriptions(event);

    // Sort by priority (lower first)
    handlers.sort((a, b) => a.sub.priority - b.sub.priority);

    const errors: Error[] = [];
    const toRemove: Array<{ event: string; sub: EventSubscription }> = [];

    for (const { event: subEvent, sub } of handlers) {
      try {
        await sub.handler(data);
      } catch (err) {
        errors.push(
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      if (sub.once) {
        toRemove.push({ event: subEvent, sub });
      }
    }

    // Remove once-subscriptions after emission
    for (const { event: subEvent, sub } of toRemove) {
      this.removeSubscription(subEvent, sub);
    }

    return errors;
  }

  /**
   * Wait for an event to be emitted. Returns a promise that resolves
   * with the event data. Optionally accepts a timeout.
   */
  waitFor<T = unknown>(
    event: string,
    timeoutMs?: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const unsub = this.once<T>(event, (data) => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        resolve(data);
      });

      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => {
          unsub();
          reject(new EventTimeoutError(event, timeoutMs));
        }, timeoutMs);
      }
    });
  }

  /**
   * Remove all subscriptions for an event (or all events if no name given).
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
    }
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(event: string): number {
    return this.subscriptions.get(event)?.length ?? 0;
  }

  /**
   * Get all registered event names.
   */
  eventNames(): string[] {
    return [...this.subscriptions.keys()];
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private addSubscription(
    event: string,
    subscription: EventSubscription,
  ): void {
    let subs = this.subscriptions.get(event);
    if (!subs) {
      subs = [];
      this.subscriptions.set(event, subs);
    }

    if (this.maxListeners > 0 && subs.length >= this.maxListeners) {
      // eslint-disable-next-line no-console
      console.warn(
        `Warning: event "${event}" has ${subs.length} listeners (max: ${this.maxListeners})`,
      );
    }

    subs.push(subscription);
    // Keep sorted by priority
    subs.sort((a, b) => a.priority - b.priority);
  }

  private removeSubscription(
    event: string,
    subscription: EventSubscription,
  ): void {
    const subs = this.subscriptions.get(event);
    if (!subs) return;

    const idx = subs.indexOf(subscription);
    if (idx !== -1) {
      subs.splice(idx, 1);
      if (subs.length === 0) {
        this.subscriptions.delete(event);
      }
    }
  }

  /**
   * Find all subscriptions matching an event name,
   * including wildcard subscriptions.
   */
  private getMatchingSubscriptions(
    event: string,
  ): Array<{ event: string; sub: EventSubscription }> {
    const result: Array<{ event: string; sub: EventSubscription }> = [];

    for (const [pattern, subs] of this.subscriptions) {
      if (this.matchesPattern(event, pattern)) {
        for (const sub of subs) {
          result.push({ event: pattern, sub });
        }
      }
    }

    return result;
  }

  /**
   * Check if an event name matches a subscription pattern.
   * Supports:
   * - Exact match: "user.created" matches "user.created"
   * - Global wildcard: "*" matches everything
   * - Prefix wildcard: "user.*" matches "user.created", "user.deleted"
   */
  private matchesPattern(event: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern === event) return true;

    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return event.startsWith(prefix + ".");
    }

    return false;
  }
}
