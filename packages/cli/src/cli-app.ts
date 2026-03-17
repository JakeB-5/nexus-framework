// @nexus/cli - CLI application

import { CommandRegistry } from "./command-registry.js";
import { ConsoleLogger } from "./logger.js";
import { parseArgs, formatHelp, formatCommandHelp } from "./parser.js";
import { TemplateEngine, getBuiltinTemplates } from "./template.js";
import type {
  CliAppOptions,
  CommandContext,
  CommandDefinition,
  CliLogger,
} from "./types.js";
import { UnknownCommandError } from "./errors.js";

/**
 * CLI application that ties together command parsing, registry,
 * template engine, and execution.
 */
export class CliApp {
  private readonly name: string;
  private readonly version: string;
  private readonly description: string;
  private readonly registry: CommandRegistry;
  private readonly templateEngine: TemplateEngine;
  private readonly logger: CliLogger;

  constructor(options: CliAppOptions) {
    this.name = options.name;
    this.version = options.version;
    this.description = options.description ?? "";
    this.registry = new CommandRegistry();
    this.templateEngine = new TemplateEngine();
    this.logger = new ConsoleLogger();

    // Register built-in templates
    for (const tmpl of getBuiltinTemplates()) {
      this.templateEngine.register(tmpl);
    }

    // Register built-in commands
    this.registerBuiltinCommands();
  }

  /**
   * Register a command.
   */
  command(definition: CommandDefinition): this {
    this.registry.register(definition);
    return this;
  }

  /**
   * Get the command registry.
   */
  getRegistry(): CommandRegistry {
    return this.registry;
  }

  /**
   * Get the template engine.
   */
  getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }

  /**
   * Run the CLI with the given arguments.
   * Typically called with process.argv.slice(2).
   */
  async run(argv: string[]): Promise<void> {
    const parsed = parseArgs(argv);

    // Handle --version / -v
    if (parsed.options["version"] === true || parsed.options["v"] === true) {
      this.logger.info(`${this.name} v${this.version}`);
      return;
    }

    // Handle no command or --help
    if (
      !parsed.command ||
      parsed.options["help"] === true ||
      parsed.options["h"] === true
    ) {
      const commands = this.registry.getAll().map((c) => ({
        name: c.name,
        description: c.description,
      }));
      this.logger.info(
        formatHelp(this.name, this.description, commands, this.version),
      );
      return;
    }

    // Handle command-specific help
    if (
      parsed.positionals.includes("--help") ||
      parsed.positionals.includes("-h")
    ) {
      try {
        const cmd = this.registry.resolve(parsed.command);
        this.logger.info(formatCommandHelp(this.name, cmd));
      } catch {
        this.logger.error(`Unknown command: ${parsed.command}`);
      }
      return;
    }

    // Execute command
    try {
      const cmd = this.registry.resolve(parsed.command);

      const context: CommandContext = {
        args: parsed,
        logger: this.logger,
        cwd: process.cwd(),
      };

      await cmd.handler(context);
    } catch (err) {
      if (err instanceof UnknownCommandError) {
        this.logger.error(err.message);
        this.logger.info(`Run "${this.name} --help" for available commands.`);
      } else {
        this.logger.error(
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  private registerBuiltinCommands(): void {
    this.registry.register({
      name: "help",
      description: "Show help for a command",
      args: [{ name: "command", description: "Command name", required: false }],
      handler: (ctx) => {
        const cmdName = ctx.args.positionals[0];
        if (cmdName) {
          try {
            const cmd = this.registry.resolve(cmdName);
            ctx.logger.info(formatCommandHelp(this.name, cmd));
          } catch {
            ctx.logger.error(`Unknown command: ${cmdName}`);
          }
        } else {
          const commands = this.registry.getAll().map((c) => ({
            name: c.name,
            description: c.description,
          }));
          ctx.logger.info(
            formatHelp(this.name, this.description, commands, this.version),
          );
        }
      },
    });

    this.registry.register({
      name: "version",
      description: "Show version",
      aliases: ["v"],
      handler: (ctx) => {
        ctx.logger.info(`${this.name} v${this.version}`);
      },
    });
  }
}
