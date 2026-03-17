/**
 * Request Logging Middleware
 *
 * In a Nexus application, @nexus/logger provides structured logging
 * with log levels, transports (console, file, external services),
 * and automatic request context injection:
 *
 *   const logger = createLogger({
 *     level: 'info',
 *     transports: [consoleTransport(), fileTransport('app.log')],
 *   });
 *
 *   app.use(requestLogger(logger));
 *
 * This implementation demonstrates the same patterns using
 * console output with structured JSON formatting.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "../config/app.config.js";

// ---------------------------------------------------------------------------
// Log levels - mirrors @nexus/logger LogLevel enum
// ---------------------------------------------------------------------------

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// ---------------------------------------------------------------------------
// ANSI color codes for terminal output
// ---------------------------------------------------------------------------

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
} as const;

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.dim,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
};

// Status code color mapping
function statusColor(code: number): string {
  if (code >= 500) return COLORS.red;
  if (code >= 400) return COLORS.yellow;
  if (code >= 300) return COLORS.cyan;
  if (code >= 200) return COLORS.green;
  return COLORS.dim;
}

// Method color mapping
function methodColor(method: string): string {
  switch (method) {
    case "GET": return COLORS.blue;
    case "POST": return COLORS.green;
    case "PUT": return COLORS.yellow;
    case "DELETE": return COLORS.red;
    case "PATCH": return COLORS.magenta;
    default: return COLORS.dim;
  }
}

// ---------------------------------------------------------------------------
// Logger class - simplified version of @nexus/logger Logger
// ---------------------------------------------------------------------------

export class Logger {
  private level: number;
  private useTimestamps: boolean;
  private useColors: boolean;

  constructor(
    level: LogLevel = "info",
    timestamps = true,
    colorize = true,
  ) {
    this.level = LOG_LEVELS[level];
    this.useTimestamps = timestamps;
    this.useColors = colorize;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (LOG_LEVELS[level] < this.level) return;

    const parts: string[] = [];

    // Timestamp
    if (this.useTimestamps) {
      const ts = new Date().toISOString();
      parts.push(this.useColors ? `${COLORS.dim}${ts}${COLORS.reset}` : ts);
    }

    // Level badge
    const levelTag = level.toUpperCase().padEnd(5);
    parts.push(
      this.useColors
        ? `${LEVEL_COLORS[level]}${levelTag}${COLORS.reset}`
        : levelTag,
    );

    // Message
    parts.push(message);

    // Extra data
    if (data && Object.keys(data).length > 0) {
      parts.push(
        this.useColors
          ? `${COLORS.dim}${JSON.stringify(data)}${COLORS.reset}`
          : JSON.stringify(data),
      );
    }

    const output = parts.join(" ");
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton logger instance
// ---------------------------------------------------------------------------

export const logger = new Logger(
  config.log.level as LogLevel,
  config.log.timestamps,
  config.log.colorize,
);

// ---------------------------------------------------------------------------
// Request logging middleware
// Logs each incoming request and the response status/timing.
// ---------------------------------------------------------------------------

export function requestLogger(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const start = Date.now();
  const method = req.method ?? "UNKNOWN";
  const url = req.url ?? "/";

  // Log when the response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const useColors = config.log.colorize;

    const methodStr = useColors
      ? `${methodColor(method)}${method.padEnd(7)}${COLORS.reset}`
      : method.padEnd(7);

    const statusStr = useColors
      ? `${statusColor(status)}${status}${COLORS.reset}`
      : String(status);

    const durationStr = useColors
      ? `${COLORS.dim}${duration}ms${COLORS.reset}`
      : `${duration}ms`;

    logger.info(`${methodStr} ${url} ${statusStr} ${durationStr}`);
  });
}
