// @nexus/logger - Type definitions

/**
 * Log levels in order of severity (lowest to highest)
 */
export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Fatal = 5,
  Silent = 6,
}

/**
 * Map level names to enum values
 */
export const LOG_LEVEL_NAMES: Record<string, LogLevel> = {
  trace: LogLevel.Trace,
  debug: LogLevel.Debug,
  info: LogLevel.Info,
  warn: LogLevel.Warn,
  error: LogLevel.Error,
  fatal: LogLevel.Fatal,
  silent: LogLevel.Silent,
};

/**
 * Map enum values to level names
 */
export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.Trace]: "TRACE",
  [LogLevel.Debug]: "DEBUG",
  [LogLevel.Info]: "INFO",
  [LogLevel.Warn]: "WARN",
  [LogLevel.Error]: "ERROR",
  [LogLevel.Fatal]: "FATAL",
  [LogLevel.Silent]: "SILENT",
};

/**
 * A structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  levelLabel: string;
  message: string;
  timestamp: Date;
  context?: string;
  data?: Record<string, unknown>;
  error?: Error;
}

/**
 * Options for creating a Logger instance
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Logger context name (e.g., class/module name) */
  context?: string;
  /** Additional data to include in every log entry */
  defaultMeta?: Record<string, unknown>;
  /** Transports to write log entries to */
  transports?: Transport[];
  /** Formatter for log entries */
  formatter?: LogFormatter;
}

/**
 * Transport interface - destinations for log entries
 */
export interface Transport {
  /** Unique name for this transport */
  readonly name: string;
  /** Write a log entry */
  write(entry: LogEntry, formatted: string): void;
  /** Flush any buffered entries */
  flush?(): void | Promise<void>;
  /** Close the transport and release resources */
  close?(): void | Promise<void>;
}

/**
 * Options for transport configuration
 */
export interface TransportOptions {
  /** Minimum level for this transport */
  level?: LogLevel;
}

/**
 * Log formatter interface
 */
export interface LogFormatter {
  /** Format a log entry into a string */
  format(entry: LogEntry): string;
}

/**
 * Console transport options
 */
export interface ConsoleTransportOptions extends TransportOptions {
  /** Whether to use colors */
  colors?: boolean;
}

/**
 * File transport options
 */
export interface FileTransportOptions extends TransportOptions {
  /** File path to write to */
  filePath: string;
  /** Maximum file size in bytes before rotation */
  maxSize?: number;
  /** Maximum number of rotated files to keep */
  maxFiles?: number;
}

/**
 * Logger module options
 */
export interface LoggerModuleOptions {
  /** Global log level */
  level?: LogLevel;
  /** Whether to make logger globally available */
  global?: boolean;
  /** Transports configuration */
  transports?: Transport[];
  /** Formatter */
  formatter?: LogFormatter;
}
