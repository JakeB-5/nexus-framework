// @nexus/logger - Core Logger class

import type { LogEntry, LoggerOptions, Transport, LogFormatter } from "./types.js";
import { LogLevel, LOG_LEVEL_LABELS } from "./types.js";
import { JsonFormatter } from "./formatter.js";

/**
 * Structured logger with support for levels, child loggers,
 * transports, and contextual metadata.
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly context: string | undefined;
  private readonly defaultMeta: Record<string, unknown>;
  private readonly transports: Transport[];
  private readonly formatter: LogFormatter;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.Info;
    this.context = options.context;
    this.defaultMeta = options.defaultMeta ?? {};
    this.transports = options.transports ?? [];
    this.formatter = options.formatter ?? new JsonFormatter();
  }

  /**
   * Create a child logger that inherits settings and adds/overrides context.
   */
  child(options: {
    context?: string;
    meta?: Record<string, unknown>;
  }): Logger {
    return new Logger({
      level: this.level,
      context: options.context ?? this.context,
      defaultMeta: { ...this.defaultMeta, ...options.meta },
      transports: this.transports,
      formatter: this.formatter,
    });
  }

  // ─── Level Methods ──────────────────────────────────────────────────

  trace(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Trace, message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Debug, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Info, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.Warn, message, data);
  }

  error(
    message: string,
    dataOrError?: Record<string, unknown> | Error,
  ): void {
    if (dataOrError instanceof Error) {
      this.log(LogLevel.Error, message, undefined, dataOrError);
    } else {
      this.log(LogLevel.Error, message, dataOrError);
    }
  }

  fatal(
    message: string,
    dataOrError?: Record<string, unknown> | Error,
  ): void {
    if (dataOrError instanceof Error) {
      this.log(LogLevel.Fatal, message, undefined, dataOrError);
    } else {
      this.log(LogLevel.Fatal, message, dataOrError);
    }
  }

  // ─── Core ───────────────────────────────────────────────────────────

  /**
   * Log a message at the specified level.
   */
  log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error,
  ): void {
    // Filter by level
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      levelLabel: LOG_LEVEL_LABELS[level] ?? "UNKNOWN",
      message: this.formatMessage(message, data),
      timestamp: new Date(),
      context: this.context,
      data: { ...this.defaultMeta, ...data },
      error,
    };

    const formatted = this.formatter.format(entry);

    for (const transport of this.transports) {
      try {
        transport.write(entry, formatted);
      } catch {
        // Logging should never throw - silently ignore transport errors
      }
    }
  }

  /**
   * Check if a level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Get the logger context
   */
  getContext(): string | undefined {
    return this.context;
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    for (const transport of this.transports) {
      if (transport.flush) {
        await transport.flush();
      }
    }
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    for (const transport of this.transports) {
      if (transport.close) {
        await transport.close();
      }
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────

  /**
   * Simple printf-style formatting: replaces %s, %d, %j placeholders
   */
  private formatMessage(
    message: string,
    data?: Record<string, unknown>,
  ): string {
    if (!data) return message;

    // Support simple interpolation with {key} syntax
    return message.replace(/\{(\w+)\}/g, (_match, key: string) => {
      if (key in data) {
        return String(data[key]);
      }
      return `{${key}}`;
    });
  }
}
