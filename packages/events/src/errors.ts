// @nexus/events - Error classes

import { NexusError } from "@nexus/core";

/**
 * Generic event error
 */
export class EventError extends NexusError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, {
      code: "EVENT_ERROR",
      ...options,
    });
    this.name = "EventError";
  }
}

/**
 * Thrown when waitFor times out
 */
export class EventTimeoutError extends NexusError {
  public readonly eventName: string;

  constructor(
    eventName: string,
    timeoutMs: number,
    options: { cause?: Error } = {},
  ) {
    super(
      `Timed out waiting for event "${eventName}" after ${timeoutMs}ms`,
      {
        code: "EVENT_TIMEOUT_ERROR",
        context: { event: eventName, timeoutMs },
        cause: options.cause,
      },
    );
    this.name = "EventTimeoutError";
    this.eventName = eventName;
  }
}
