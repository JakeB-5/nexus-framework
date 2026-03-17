// Retry strategies for failed jobs

import type { BackoffOptions } from "../types.js";

export function calculateBackoff(
  backoff: BackoffOptions | undefined,
  attemptsMade: number,
): number {
  if (!backoff) {
    return 0;
  }

  const baseDelay = backoff.delay ?? 1000;

  switch (backoff.type) {
    case "fixed":
      return baseDelay;

    case "exponential":
      return baseDelay * Math.pow(2, attemptsMade - 1);

    case "custom":
      if (backoff.customFn) {
        return backoff.customFn(attemptsMade);
      }
      return baseDelay;

    default:
      return baseDelay;
  }
}

export function createFixedBackoff(delay: number): BackoffOptions {
  return { type: "fixed", delay };
}

export function createExponentialBackoff(baseDelay: number): BackoffOptions {
  return { type: "exponential", delay: baseDelay };
}

export function createCustomBackoff(
  fn: (attemptsMade: number) => number,
): BackoffOptions {
  return { type: "custom", customFn: fn };
}
