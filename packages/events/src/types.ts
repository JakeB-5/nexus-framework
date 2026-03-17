// @nexus/events - Type definitions

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Options for event subscription
 */
export interface EventSubscriptionOptions {
  /** Priority for handler ordering (lower runs first, default: 100) */
  priority?: number;
  /** Label for debugging */
  label?: string;
}

/**
 * Internal subscription record
 */
export interface EventSubscription<T = unknown> {
  handler: EventHandler<T>;
  priority: number;
  once: boolean;
  label?: string;
}

/**
 * Options for EventBus configuration
 */
export interface EventBusOptions {
  /** Maximum number of listeners per event (0 = unlimited) */
  maxListeners?: number;
  /** Whether to log warnings for unhandled events */
  warnOnUnhandled?: boolean;
}

/**
 * EventMap type - maps event names to their data types.
 * Used for type-safe event definitions.
 *
 * @example
 * ```ts
 * interface AppEvents extends EventMap {
 *   'user.created': { id: string; name: string };
 *   'user.deleted': { id: string };
 * }
 * ```
 */
export interface EventMap {
  [event: string]: unknown;
}

/**
 * Event module options
 */
export interface EventModuleOptions {
  /** Whether to make event bus globally available */
  global?: boolean;
  /** EventBus configuration */
  busOptions?: EventBusOptions;
}
