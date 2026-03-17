// @nexus/cli - CLI tool for scaffolding and code generation

export { CliApp } from "./cli-app.js";
export { CommandRegistry } from "./command-registry.js";
export { parseArgs, formatHelp, formatCommandHelp } from "./parser.js";
export { TemplateEngine, templateFile, getBuiltinTemplates } from "./template.js";
export { ConsoleLogger, SilentLogger } from "./logger.js";
export {
  CliError,
  UnknownCommandError,
  MissingArgumentError,
  TemplateError,
} from "./errors.js";
export type {
  ParsedArgs,
  CommandDefinition,
  CommandHandler,
  CommandContext,
  ArgDefinition,
  OptionDefinition,
  CliLogger,
  CliAppOptions,
  TemplateDefinition,
  TemplateFile,
} from "./types.js";
