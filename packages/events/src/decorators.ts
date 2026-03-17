// @nexus/events - Event decorators

import type { Constructor } from "@nexus/core";

/** Storage for @OnEvent metadata, keyed by class prototype */
const eventHandlerMetadata = new WeakMap<
  object,
  Array<{ event: string; method: string; priority?: number }>
>();

/**
 * Method decorator that marks a method as an event handler.
 * Used with the event module to auto-subscribe handlers.
 *
 * @example
 * ```ts
 * class UserListener {
 *   @OnEvent('user.created')
 *   handleUserCreated(data: { id: string }) {
 *     console.log('User created:', data.id);
 *   }
 * }
 * ```
 */
export function OnEvent(
  event: string,
  options?: { priority?: number },
): (
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => void {
  return (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor,
  ): void => {
    // target is the prototype for instance methods
    let handlers = eventHandlerMetadata.get(target);
    if (!handlers) {
      handlers = [];
      eventHandlerMetadata.set(target, handlers);
    }
    handlers.push({
      event,
      method: propertyKey,
      priority: options?.priority,
    });
  };
}

/**
 * Get event handler metadata for a class
 */
export function getEventHandlers(
  target: Constructor,
): ReadonlyArray<{ event: string; method: string; priority?: number }> {
  return eventHandlerMetadata.get(target.prototype as object) ?? [];
}

/**
 * Check if a class has any @OnEvent handlers
 */
export function hasEventHandlers(target: Constructor): boolean {
  const handlers = eventHandlerMetadata.get(target.prototype as object);
  return handlers !== undefined && handlers.length > 0;
}
