// @nexus/storage - Error types

import { NexusError } from "@nexus/core";

/**
 * Base storage error
 */
export class StorageError extends NexusError {
  constructor(message: string, options: { code?: string; cause?: Error } = {}) {
    super(message, { code: options.code ?? "STORAGE_ERROR", cause: options.cause });
    this.name = "StorageError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends StorageError {
  public readonly filePath: string;

  constructor(filePath: string) {
    super(`File not found: ${filePath}`, { code: "FILE_NOT_FOUND" });
    this.name = "FileNotFoundError";
    this.filePath = filePath;
  }
}

/**
 * Permission error
 */
export class PermissionError extends StorageError {
  constructor(message: string) {
    super(message, { code: "PERMISSION_ERROR" });
    this.name = "PermissionError";
  }
}
