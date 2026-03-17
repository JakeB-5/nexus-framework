// @nexus/events - Base class for event-emitting objects

import { EventBus } from "./event-bus.js";
import type { EventHandler, EventSubscriptionOptions } from "./types.js";

/**
 * Base class for objects that emit events.
 * Wraps an internal EventBus instance.
 *
 * @example
 * ```ts
 * class UserService extends EventEmitter {
 *   async createUser(name: string) {
 *     const user = { id: '1', name };
 *     await this.emit('user.created', user);
 *     return user;
 *   }
 * }
 *
 * const service = new UserService();
 * service.on('user.created', (user) => console.log('New user:', user));
 * ```
 */
export class EventEmitter {
  private readonly bus: EventBus;

  constructor(bus?: EventBus) {
    this.bus = bus ?? new EventBus();
  }

  /**
   * Subscribe to an event
   */
  on<T = unknown>(
    event: string,
    handler: EventHandler<T>,
    options?: EventSubscriptionOptions,
  ): () => void {
    return this.bus.on(event, handler, options);
  }

  /**
   * Subscribe to an event for a single emission
   */
  once<T = unknown>(
    event: string,
    handler: EventHandler<T>,
    options?: EventSubscriptionOptions,
  ): () => void {
    return this.bus.once(event, handler, options);
  }

  /**
   * Unsubscribe a handler
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.bus.off(event, handler);
  }

  /**
   * Emit an event
   */
  protected async emit<T = unknown>(
    event: string,
    data: T,
  ): Promise<Error[]> {
    return this.bus.emit(event, data);
  }

  /**
   * Wait for an event
   */
  waitFor<T = unknown>(
    event: string,
    timeoutMs?: number,
  ): Promise<T> {
    return this.bus.waitFor(event, timeoutMs);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: string): void {
    this.bus.removeAllListeners(event);
  }
}
