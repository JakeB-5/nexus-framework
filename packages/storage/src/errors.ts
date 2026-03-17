// @nexus/storage - Error types

/**
 * Base storage error
 */
export class StorageError extends Error {
  public readonly code: string;

  constructor(message: string, options: { code?: string; cause?: Error } = {}) {
    super(message);
    this.name = "StorageError";
    this.code = options.code ?? "STORAGE_ERROR";
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
