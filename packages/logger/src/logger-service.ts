// @nexus/logger - Injectable NexusLogger service

import { Logger } from "./logger.js";
import type { LoggerOptions } from "./types.js";
import { LogLevel } from "./types.js";
import { JsonFormatter } from "./formatter.js";

/**
 * Injectable logger service for use with the DI container.
 * Wraps the Logger class and provides per-module instances.
 */
export class NexusLogger {
  private readonly rootLogger: Logger;
  private readonly loggers = new Map<string, Logger>();

  constructor(options: LoggerOptions = {}) {
    this.rootLogger = new Logger({
      level: options.level ?? LogLevel.Info,
      transports: options.transports ?? [],
      formatter: options.formatter ?? new JsonFormatter(),
      defaultMeta: options.defaultMeta,
    });
  }

  /**
   * Get a logger instance for a specific context (module/service name).
   * Caches logger instances by context name.
   */
  forContext(context: string): Logger {
    let logger = this.loggers.get(context);
    if (!logger) {
      logger = this.rootLogger.child({ context });
      this.loggers.set(context, logger);
    }
    return logger;
  }

  /**
   * Get the root logger (no context)
   */
  getRoot(): Logger {
    return this.rootLogger;
  }

  // ─── Convenience methods that delegate to root logger ──────────────

  trace(message: string, data?: Record<string, unknown>): void {
    this.rootLogger.trace(message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.rootLogger.debug(message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.rootLogger.info(message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.rootLogger.warn(message, data);
  }

  error(
    message: string,
    dataOrError?: Record<string, unknown> | Error,
  ): void {
    this.rootLogger.error(message, dataOrError);
  }

  fatal(
    message: string,
    dataOrError?: Record<string, unknown> | Error,
  ): void {
    this.rootLogger.fatal(message, dataOrError);
  }

  /**
   * Flush all transports on the root logger
   */
  async flush(): Promise<void> {
    await this.rootLogger.flush();
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    await this.rootLogger.close();
  }
}
