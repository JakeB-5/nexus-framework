// @nexus/config - Error classes

import { NexusError } from "@nexus/core";
import type { ConfigValidationDetail } from "./types.js";

/**
 * Generic configuration error
 */
export class ConfigError extends NexusError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, {
      code: "CONFIG_ERROR",
      ...options,
    });
    this.name = "ConfigError";
  }
}

/**
 * Thrown when config validation fails
 */
export class ConfigValidationError extends NexusError {
  public readonly details: ConfigValidationDetail[];

  constructor(
    details: ConfigValidationDetail[],
    options: { cause?: Error } = {},
  ) {
    const messages = details.map((d) => `  - ${d.path}: ${d.message}`);
    super(`Configuration validation failed:\n${messages.join("\n")}`, {
      code: "CONFIG_VALIDATION_ERROR",
      context: { details },
      cause: options.cause,
    });
    this.name = "ConfigValidationError";
    this.details = details;
  }
}

/**
 * Thrown when a required config key is missing
 */
export class ConfigNotFoundError extends NexusError {
  public readonly key: string;

  constructor(
    key: string,
    options: { cause?: Error } = {},
  ) {
    super(`Configuration key not found: ${key}`, {
      code: "CONFIG_NOT_FOUND_ERROR",
      context: { key },
      cause: options.cause,
    });
    this.name = "ConfigNotFoundError";
    this.key = key;
  }
}
