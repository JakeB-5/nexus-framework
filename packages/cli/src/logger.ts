// @nexus/cli - CLI logger with colored output

import type { CliLogger } from "./types.js";

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
} as const;

/**
 * Console logger with colored prefixes for CLI output.
 */
export class ConsoleLogger implements CliLogger {
  private readonly useColors: boolean;

  constructor(options?: { colors?: boolean }) {
    this.useColors = options?.colors ?? true;
  }

  info(message: string): void {
    if (this.useColors) {
      process.stdout.write(`${COLORS.blue}info${COLORS.reset}  ${message}\n`);
    } else {
      process.stdout.write(`info  ${message}\n`);
    }
  }

  success(message: string): void {
    if (this.useColors) {
      process.stdout.write(`${COLORS.green}${COLORS.bold}done${COLORS.reset}  ${message}\n`);
    } else {
      process.stdout.write(`done  ${message}\n`);
    }
  }

  warn(message: string): void {
    if (this.useColors) {
      process.stderr.write(`${COLORS.yellow}warn${COLORS.reset}  ${message}\n`);
    } else {
      process.stderr.write(`warn  ${message}\n`);
    }
  }

  error(message: string): void {
    if (this.useColors) {
      process.stderr.write(`${COLORS.red}${COLORS.bold}error${COLORS.reset} ${message}\n`);
    } else {
      process.stderr.write(`error ${message}\n`);
    }
  }

  debug(message: string): void {
    if (this.useColors) {
      process.stdout.write(`${COLORS.gray}debug${COLORS.reset} ${message}\n`);
    } else {
      process.stdout.write(`debug ${message}\n`);
    }
  }
}

/**
 * Silent logger that discards all output. Useful for testing.
 */
export class SilentLogger implements CliLogger {
  info(_message: string): void {}
  success(_message: string): void {}
  warn(_message: string): void {}
  error(_message: string): void {}
  debug(_message: string): void {}
}
