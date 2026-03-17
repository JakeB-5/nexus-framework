// @nexus/logger - Console transport with color support

import type { LogEntry, ConsoleTransportOptions } from "../types.js";
import { LogLevel } from "../types.js";
import { BaseTransport } from "./transport.js";

/**
 * Console transport - writes log entries to stdout/stderr.
 * Error and Fatal levels write to stderr, all others to stdout.
 */
export class ConsoleTransport extends BaseTransport {
  readonly name = "console";

  constructor(options?: ConsoleTransportOptions) {
    super(options);
  }

  protected writeEntry(entry: LogEntry, formatted: string): void {
    if (entry.level >= LogLevel.Error) {
      process.stderr.write(formatted + "\n");
    } else {
      process.stdout.write(formatted + "\n");
    }
  }
}
