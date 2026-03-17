// @nexus/cli - Error classes

import { NexusError } from "@nexus/core";

/**
 * Generic CLI error
 */
export class CliError extends NexusError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, {
      code: "CLI_ERROR",
      ...options,
    });
    this.name = "CliError";
  }
}

/**
 * Thrown when an unknown command is invoked
 */
export class UnknownCommandError extends NexusError {
  public readonly commandName: string;

  constructor(commandName: string) {
    super(`Unknown command: "${commandName}"`, {
      code: "UNKNOWN_COMMAND_ERROR",
      context: { command: commandName },
    });
    this.name = "UnknownCommandError";
    this.commandName = commandName;
  }
}

/**
 * Thrown when required arguments are missing
 */
export class MissingArgumentError extends NexusError {
  public readonly argName: string;

  constructor(argName: string, commandName: string) {
    super(`Missing required argument "${argName}" for command "${commandName}"`, {
      code: "MISSING_ARGUMENT_ERROR",
      context: { arg: argName, command: commandName },
    });
    this.name = "MissingArgumentError";
    this.argName = argName;
  }
}

/**
 * Thrown when template generation fails
 */
export class TemplateError extends NexusError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, {
      code: "TEMPLATE_ERROR",
      ...options,
    });
    this.name = "TemplateError";
  }
}
