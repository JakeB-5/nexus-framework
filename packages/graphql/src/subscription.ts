// @nexus/graphql - Subscription support with PubSub

// ─── PubSub ───────────────────────────────────────────────────────────────

interface Subscriber<T = unknown> {
  callback: (payload: T) => void;
  filter?: (payload: T) => boolean | Promise<boolean>;
}

/**
 * Simple typed PubSub for GraphQL subscriptions
 */
export class PubSub {
  private subscribers = new Map<string, Set<Subscriber>>();
  private idCounter = 0;
  private subscriptionMap = new Map<number, { event: string; subscriber: Subscriber }>();

  /**
   * Publish an event with a payload
   */
  async publish<T = unknown>(event: string, payload: T): Promise<void> {
    const subs = this.subscribers.get(event);
    if (!subs) return;

    const promises: Promise<void>[] = [];
    for (const sub of subs) {
      if (sub.filter) {
        const shouldDeliver = await sub.filter(payload);
        if (!shouldDeliver) continue;
      }
      promises.push(
        Promise.resolve().then(() => sub.callback(payload)),
      );
    }
    await Promise.all(promises);
  }

  /**
   * Subscribe to an event and return an AsyncIterableIterator
   */
  subscribe<T = unknown>(
    event: string,
    options?: { filter?: (payload: T) => boolean | Promise<boolean> },
  ): AsyncIterableIterator<T> & { id: number } {
    const pullQueue: Array<(value: IteratorResult<T>) => void> = [];
    const pushQueue: T[] = [];
    let done = false;
    const id = ++this.idCounter;

    // Capture references for use in closure
    const subscribersMap = this.subscribers;
    const subMap = this.subscriptionMap;

    const subscriber: Subscriber<T> = {
      callback: (payload: T) => {
        if (done) return;
        if (pullQueue.length > 0) {
          const resolve = pullQueue.shift()!;
          resolve({ value: payload, done: false });
        } else {
          pushQueue.push(payload);
        }
      },
      filter: options?.filter,
    };

    // Register subscriber
    let subs = subscribersMap.get(event);
    if (!subs) {
      subs = new Set();
      subscribersMap.set(event, subs);
    }
    subs.add(subscriber as Subscriber);
    subMap.set(id, { event, subscriber: subscriber as Subscriber });

    const cleanup = (): void => {
      const subInfo = subMap.get(id);
      if (subInfo) {
        const eventSubs = subscribersMap.get(subInfo.event);
        if (eventSubs) {
          eventSubs.delete(subInfo.subscriber);
          if (eventSubs.size === 0) {
            subscribersMap.delete(subInfo.event);
          }
        }
        subMap.delete(id);
      }
    };

    const iterator: AsyncIterableIterator<T> & { id: number } = {
      id,
      next(): Promise<IteratorResult<T>> {
        if (done) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        if (pushQueue.length > 0) {
          return Promise.resolve({ value: pushQueue.shift()!, done: false });
        }
        return new Promise((resolve) => {
          pullQueue.push(resolve);
        });
      },
      return(): Promise<IteratorResult<T>> {
        done = true;
        for (const resolve of pullQueue) {
          resolve({ value: undefined as unknown as T, done: true });
        }
        pullQueue.length = 0;
        pushQueue.length = 0;
        cleanup();
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      },
      throw(error?: unknown): Promise<IteratorResult<T>> {
        done = true;
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    return iterator;
  }

  /**
   * Unsubscribe by subscription ID
   */
  unsubscribe(id: number): void {
    const subInfo = this.subscriptionMap.get(id);
    if (!subInfo) return;
    const subs = this.subscribers.get(subInfo.event);
    if (subs) {
      subs.delete(subInfo.subscriber);
      if (subs.size === 0) {
        this.subscribers.delete(subInfo.event);
      }
    }
    this.subscriptionMap.delete(id);
  }

  /**
   * Check if there are subscribers for an event
   */
  hasSubscribers(event: string): boolean {
    const subs = this.subscribers.get(event);
    return subs !== undefined && subs.size > 0;
  }

  /**
   * Get subscriber count for an event
   */
  subscriberCount(event: string): number {
    return this.subscribers.get(event)?.size ?? 0;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscribers.clear();
    this.subscriptionMap.clear();
  }
}

// ─── Connection Manager ───────────────────────────────────────────────────

interface SubscriptionConnection {
  id: string;
  event: string;
  subscriptionId: number;
  context: unknown;
  createdAt: Date;
}

/**
 * Manages active subscription connections
 */
export class ConnectionManager {
  private connections = new Map<string, SubscriptionConnection>();
  private pubsub: PubSub;

  constructor(pubsub: PubSub) {
    this.pubsub = pubsub;
  }

  /**
   * Register a new connection
   */
  add(id: string, event: string, subscriptionId: number, context?: unknown): void {
    this.connections.set(id, {
      id,
      event,
      subscriptionId,
      context,
      createdAt: new Date(),
    });
  }

  /**
   * Remove and cleanup a connection
   */
  remove(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      this.pubsub.unsubscribe(conn.subscriptionId);
      this.connections.delete(id);
    }
  }

  /**
   * Get a connection by ID
   */
  get(id: string): SubscriptionConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all active connections
   */
  getAll(): SubscriptionConnection[] {
    return [...this.connections.values()];
  }

  /**
   * Get connection count
   */
  get size(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [id] of this.connections) {
      this.remove(id);
    }
  }
}

/**
 * Create an async iterator that filters events
 */
export function withFilter<T>(
  asyncIterator: AsyncIterableIterator<T>,
  filterFn: (payload: T) => boolean | Promise<boolean>,
): AsyncIterableIterator<T> {
  return {
    async next(): Promise<IteratorResult<T>> {
      while (true) {
        const result = await asyncIterator.next();
        if (result.done) return result;
        if (await filterFn(result.value)) {
          return result;
        }
      }
    },
    return(): Promise<IteratorResult<T>> {
      if (asyncIterator.return) {
        return asyncIterator.return();
      }
      return Promise.resolve({ value: undefined as unknown as T, done: true });
    },
    throw(error?: unknown): Promise<IteratorResult<T>> {
      if (asyncIterator.throw) {
        return asyncIterator.throw(error);
      }
      return Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
