// @nexus/cli - Command registry

import type { CommandDefinition, CommandHandler } from "./types.js";
import { UnknownCommandError } from "./errors.js";

/**
 * Registry for CLI commands.
 * Stores command definitions and resolves commands by name or alias.
 */
export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>();

  /**
   * Register a command definition.
   */
  register(definition: CommandDefinition): this {
    this.commands.set(definition.name, definition);

    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliases.set(alias, definition.name);
      }
    }

    return this;
  }

  /**
   * Register a simple command with just a name, description, and handler.
   */
  add(
    name: string,
    description: string,
    handler: CommandHandler,
  ): this {
    return this.register({ name, description, handler });
  }

  /**
   * Resolve a command by name or alias.
   * Throws UnknownCommandError if not found.
   */
  resolve(nameOrAlias: string): CommandDefinition {
    // Direct match
    const direct = this.commands.get(nameOrAlias);
    if (direct) return direct;

    // Alias match
    const aliasTarget = this.aliases.get(nameOrAlias);
    if (aliasTarget) {
      const cmd = this.commands.get(aliasTarget);
      if (cmd) return cmd;
    }

    throw new UnknownCommandError(nameOrAlias);
  }

  /**
   * Check if a command exists.
   */
  has(nameOrAlias: string): boolean {
    return (
      this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias)
    );
  }

  /**
   * Get all registered command definitions.
   */
  getAll(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  /**
   * Get all command names (not aliases).
   */
  getNames(): string[] {
    return [...this.commands.keys()];
  }

  /**
   * Get the number of registered commands.
   */
  get size(): number {
    return this.commands.size;
  }

  /**
   * Remove a command by name.
   */
  remove(name: string): boolean {
    const cmd = this.commands.get(name);
    if (!cmd) return false;

    this.commands.delete(name);

    // Remove aliases
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliases.delete(alias);
      }
    }

    return true;
  }

  /**
   * Clear all commands.
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }
}
