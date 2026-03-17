// @nexus/cli - Argument parser

import type { ParsedArgs } from "./types.js";

/**
 * Parse command-line arguments into a structured format.
 *
 * Supports:
 * - Positional arguments
 * - Long options: --key=value, --key value, --flag
 * - Short options: -k value, -f (boolean)
 * - Double dash (--) to stop option parsing
 * - Negation: --no-flag sets flag to false
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const options: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command = "";
  let stopParsing = false;
  let commandFound = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (stopParsing) {
      positionals.push(arg);
      i++;
      continue;
    }

    // Stop option parsing after --
    if (arg === "--") {
      stopParsing = true;
      i++;
      continue;
    }

    // Long option: --key=value or --key value or --flag
    if (arg.startsWith("--")) {
      const withoutDashes = arg.slice(2);

      // Handle --no-flag negation
      if (withoutDashes.startsWith("no-")) {
        const key = withoutDashes.slice(3);
        options[key] = false;
        i++;
        continue;
      }

      const eqIndex = withoutDashes.indexOf("=");
      if (eqIndex !== -1) {
        // --key=value
        const key = withoutDashes.slice(0, eqIndex);
        const value = withoutDashes.slice(eqIndex + 1);
        options[key] = value;
      } else {
        // --flag or --key value
        const key = withoutDashes;
        const nextArg = argv[i + 1];

        if (nextArg !== undefined && !nextArg.startsWith("-")) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      }

      i++;
      continue;
    }

    // Short option: -k value or -f
    if (arg.startsWith("-") && arg.length >= 2) {
      const key = arg.slice(1);

      // Handle combined short flags: -abc → a=true, b=true, c=true
      if (key.length > 1) {
        for (const char of key) {
          options[char] = true;
        }
        i++;
        continue;
      }

      const nextArg = argv[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith("-")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }

      i++;
      continue;
    }

    // Positional argument
    if (!commandFound) {
      command = arg;
      commandFound = true;
    } else {
      positionals.push(arg);
    }

    i++;
  }

  return { command, positionals, options };
}

/**
 * Format a help message for display
 */
export function formatHelp(
  name: string,
  description: string,
  commands: Array<{ name: string; description: string }>,
  version: string,
): string {
  const lines: string[] = [
    `${name} v${version}`,
    "",
    description,
    "",
    "Usage:",
    `  ${name} <command> [options]`,
    "",
    "Commands:",
  ];

  const maxLen = Math.max(...commands.map((c) => c.name.length));
  for (const cmd of commands) {
    lines.push(`  ${cmd.name.padEnd(maxLen + 2)} ${cmd.description}`);
  }

  lines.push("");
  lines.push("Options:");
  lines.push("  --help, -h     Show help");
  lines.push("  --version, -v  Show version");
  lines.push("");

  return lines.join("\n");
}

/**
 * Format help for a specific command
 */
export function formatCommandHelp(
  appName: string,
  command: {
    name: string;
    description: string;
    help?: string;
    args?: Array<{ name: string; description: string; required?: boolean }>;
    options?: Array<{
      name: string;
      description: string;
      alias?: string;
      type?: string;
      default?: string | boolean;
    }>;
  },
): string {
  const lines: string[] = [command.description, ""];

  if (command.help) {
    lines.push(command.help, "");
  }

  // Usage line
  const argParts = (command.args ?? []).map((a) =>
    a.required ? `<${a.name}>` : `[${a.name}]`,
  );
  lines.push("Usage:");
  lines.push(`  ${appName} ${command.name} ${argParts.join(" ")}`.trimEnd());
  lines.push("");

  // Arguments
  if (command.args && command.args.length > 0) {
    lines.push("Arguments:");
    const maxLen = Math.max(...command.args.map((a) => a.name.length));
    for (const arg of command.args) {
      const req = arg.required ? " (required)" : "";
      lines.push(`  ${arg.name.padEnd(maxLen + 2)} ${arg.description}${req}`);
    }
    lines.push("");
  }

  // Options
  if (command.options && command.options.length > 0) {
    lines.push("Options:");
    const maxLen = Math.max(
      ...command.options.map(
        (o) => (o.alias ? `--${o.name}, -${o.alias}` : `--${o.name}`).length,
      ),
    );
    for (const opt of command.options) {
      const flag = opt.alias
        ? `--${opt.name}, -${opt.alias}`
        : `--${opt.name}`;
      const def =
        opt.default !== undefined ? ` (default: ${String(opt.default)})` : "";
      lines.push(`  ${flag.padEnd(maxLen + 2)} ${opt.description}${def}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
