// @nexus/logger - Log formatters

import type { LogEntry, LogFormatter } from "./types.js";

/**
 * JSON formatter - outputs structured JSON strings.
 * Ideal for machine consumption and log aggregation.
 */
export class JsonFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const obj: Record<string, unknown> = {
      level: entry.levelLabel.toLowerCase(),
      timestamp: entry.timestamp.toISOString(),
      message: entry.message,
    };

    if (entry.context) {
      obj.context = entry.context;
    }

    if (entry.data && Object.keys(entry.data).length > 0) {
      obj.data = entry.data;
    }

    if (entry.error) {
      obj.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    return JSON.stringify(obj);
  }
}

/**
 * Pretty formatter - outputs human-readable colored text.
 * Ideal for development and debugging.
 */
export class PrettyFormatter implements LogFormatter {
  private readonly colors: boolean;

  constructor(options?: { colors?: boolean }) {
    this.colors = options?.colors ?? true;
  }

  format(entry: LogEntry): string {
    const time = formatTime(entry.timestamp);
    const level = entry.levelLabel.padEnd(5);
    const ctx = entry.context ? ` [${entry.context}]` : "";

    let line: string;
    if (this.colors) {
      const colorCode = LEVEL_COLORS[entry.levelLabel] ?? "\x1b[0m";
      line = `${"\x1b[90m"}${time}\x1b[0m ${colorCode}${level}\x1b[0m${"\x1b[36m"}${ctx}\x1b[0m ${entry.message}`;
    } else {
      line = `${time} ${level}${ctx} ${entry.message}`;
    }

    if (entry.data && Object.keys(entry.data).length > 0) {
      line += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      line += `\n  ${entry.error.stack ?? entry.error.message}`;
    }

    return line;
  }
}

/**
 * Minimal formatter - outputs just level and message.
 * Ideal for constrained environments.
 */
export class MinimalFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const prefix = entry.context ? `[${entry.context}] ` : "";
    return `${entry.levelLabel} ${prefix}${entry.message}`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  TRACE: "\x1b[90m",   // gray
  DEBUG: "\x1b[34m",   // blue
  INFO: "\x1b[32m",    // green
  WARN: "\x1b[33m",    // yellow
  ERROR: "\x1b[31m",   // red
  FATAL: "\x1b[35m",   // magenta
};

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}
