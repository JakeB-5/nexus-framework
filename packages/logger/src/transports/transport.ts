// @nexus/logger - Base transport

import type { LogEntry, Transport, TransportOptions } from "../types.js";
import { LogLevel } from "../types.js";

/**
 * Base transport class that handles level filtering.
 * Subclasses implement writeEntry() for actual output.
 */
export abstract class BaseTransport implements Transport {
  abstract readonly name: string;
  protected readonly minLevel: LogLevel;

  constructor(options?: TransportOptions) {
    this.minLevel = options?.level ?? LogLevel.Trace;
  }

  write(entry: LogEntry, formatted: string): void {
    if (entry.level >= this.minLevel) {
      this.writeEntry(entry, formatted);
    }
  }

  /**
   * Implement this method to handle filtered log entries
   */
  protected abstract writeEntry(entry: LogEntry, formatted: string): void;
}
