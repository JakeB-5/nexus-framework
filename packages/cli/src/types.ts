// @nexus/cli - Type definitions

/**
 * Parsed CLI arguments
 */
export interface ParsedArgs {
  /** The command name (first positional argument) */
  command: string;
  /** Positional arguments after the command */
  positionals: string[];
  /** Named flags and options (--key=value or --flag) */
  options: Record<string, string | boolean>;
}

/**
 * CLI command definition
 */
export interface CommandDefinition {
  /** Command name */
  name: string;
  /** Short description */
  description: string;
  /** Detailed help text */
  help?: string;
  /** Command aliases */
  aliases?: string[];
  /** Expected positional argument names (for help display) */
  args?: ArgDefinition[];
  /** Expected option definitions */
  options?: OptionDefinition[];
  /** The handler function */
  handler: CommandHandler;
}

/**
 * Positional argument definition
 */
export interface ArgDefinition {
  name: string;
  description: string;
  required?: boolean;
}

/**
 * Option definition
 */
export interface OptionDefinition {
  name: string;
  description: string;
  alias?: string;
  type?: "string" | "boolean";
  default?: string | boolean;
  required?: boolean;
}

/**
 * Command handler function
 */
export type CommandHandler = (context: CommandContext) => void | Promise<void>;

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  /** Parsed arguments */
  args: ParsedArgs;
  /** Logger for command output */
  logger: CliLogger;
  /** Project root path */
  cwd: string;
}

/**
 * CLI logger interface for consistent output
 */
export interface CliLogger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

/**
 * Template definition for code generation
 */
export interface TemplateDefinition {
  /** Template name */
  name: string;
  /** Files to generate */
  files: TemplateFile[];
}

/**
 * A file to generate from a template
 */
export interface TemplateFile {
  /** Output path (supports {{variable}} interpolation) */
  path: string;
  /** Template content (supports {{variable}} interpolation) */
  content: string;
}

/**
 * CLI application options
 */
export interface CliAppOptions {
  /** Application name */
  name: string;
  /** Application version */
  version: string;
  /** Application description */
  description?: string;
}
