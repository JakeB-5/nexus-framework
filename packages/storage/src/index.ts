// @nexus/storage - File storage abstraction for local and cloud

export { StorageAdapter } from "./adapters/adapter.js";
export { MemoryAdapter } from "./adapters/memory-adapter.js";
export { LocalAdapter } from "./adapters/local-adapter.js";
export { Disk } from "./disk.js";
export { StorageManager } from "./storage-manager.js";
export { StorageModule } from "./storage-module.js";
export { StorageError, FileNotFoundError, PermissionError } from "./errors.js";
export {
  normalizePath,
  sanitizePath,
  isPathSafe,
  getExtension,
  getFilename,
  getDirectory,
  joinPath,
  getMimeType,
} from "./path-utils.js";
export type { FileInfo, FileStat, WriteOptions, DiskConfig, StorageOptions } from "./types.js";
