// @nexus/core - Error hierarchy

import type { Token } from "./types.js";
import { getTokenName } from "./utils.js";

/**
 * Base error class for all Nexus errors.
 * Provides error code, context, and cause chain support.
 */
export class NexusError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public override readonly cause?: Error;
  public readonly timestamp: Date;

  constructor(
    message: string,
    options: {
      code?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {},
  ) {
    super(message);
    this.name = "NexusError";
    this.code = options.code ?? "NEXUS_ERROR";
    this.context = options.context ?? {};
    this.cause = options.cause;
    this.timestamp = new Date();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a formatted string with the full error chain
   */
  toDetailedString(): string {
    const parts: string[] = [
      `[${this.code}] ${this.name}: ${this.message}`,
    ];

    if (Object.keys(this.context).length > 0) {
      parts.push(`  Context: ${JSON.stringify(this.context)}`);
    }

    if (this.cause) {
      parts.push(`  Caused by: ${this.cause.message}`);
      if (this.cause instanceof NexusError) {
        parts.push(
          this.cause
            .toDetailedString()
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n"),
        );
      }
    }

    return parts.join("\n");
  }
}

/**
 * Thrown when a dependency cannot be resolved from the container.
 */
export class DependencyResolutionError extends NexusError {
  public readonly token: Token;

  constructor(
    token: Token,
    message?: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    const tokenName = getTokenName(token);
    super(
      message ?? `Unable to resolve dependency: ${tokenName}`,
      {
        code: "DEPENDENCY_RESOLUTION_ERROR",
        context: { token: tokenName, ...options.context },
        cause: options.cause,
      },
    );
    this.name = "DependencyResolutionError";
    this.token = token;
  }
}

/**
 * Thrown when circular dependencies are detected.
 */
export class CircularDependencyError extends NexusError {
  public readonly chain: string[];

  constructor(
    chain: string[],
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    const cycle = chain.join(" → ");
    super(`Circular dependency detected: ${cycle}`, {
      code: "CIRCULAR_DEPENDENCY_ERROR",
      context: { chain, ...options.context },
      cause: options.cause,
    });
    this.name = "CircularDependencyError";
    this.chain = chain;
  }
}

/**
 * Thrown when module initialization fails.
 */
export class ModuleInitializationError extends NexusError {
  public readonly moduleName: string;

  constructor(
    moduleName: string,
    message?: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(
      message ?? `Failed to initialize module: ${moduleName}`,
      {
        code: "MODULE_INITIALIZATION_ERROR",
        context: { module: moduleName, ...options.context },
        cause: options.cause,
      },
    );
    this.name = "ModuleInitializationError";
    this.moduleName = moduleName;
  }
}

/**
 * Thrown when a lifecycle hook fails.
 */
export class LifecycleError extends NexusError {
  public readonly phase: string;
  public readonly targetName: string;

  constructor(
    phase: string,
    targetName: string,
    message?: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(
      message ??
        `Lifecycle error during ${phase} for ${targetName}`,
      {
        code: "LIFECYCLE_ERROR",
        context: { phase, target: targetName, ...options.context },
        cause: options.cause,
      },
    );
    this.name = "LifecycleError";
    this.phase = phase;
    this.targetName = targetName;
  }
}

/**
 * Thrown when a hook execution fails.
 */
export class HookExecutionError extends NexusError {
  public readonly hookName: string;

  constructor(
    hookName: string,
    message?: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(
      message ?? `Hook execution failed: ${hookName}`,
      {
        code: "HOOK_EXECUTION_ERROR",
        context: { hook: hookName, ...options.context },
        cause: options.cause,
      },
    );
    this.name = "HookExecutionError";
    this.hookName = hookName;
  }
}

/**
 * Thrown when a module has invalid metadata or configuration.
 */
export class InvalidModuleError extends NexusError {
  public readonly moduleName: string;

  constructor(
    moduleName: string,
    message?: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(
      message ?? `Invalid module configuration: ${moduleName}`,
      {
        code: "INVALID_MODULE_ERROR",
        context: { module: moduleName, ...options.context },
        cause: options.cause,
      },
    );
    this.name = "InvalidModuleError";
    this.moduleName = moduleName;
  }
}
