// @nexus/storage - Type definitions

/**
 * File information returned by list()
 */
export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
}

/**
 * File stat information
 */
export interface FileStat {
  path: string;
  size: number;
  lastModified: Date;
  createdAt: Date;
  isDirectory: boolean;
  isFile: boolean;
  mimeType?: string;
}

/**
 * Write options
 */
export interface WriteOptions {
  /** Content type / MIME type */
  contentType?: string;
  /** File permissions (octal, e.g. 0o644) */
  permissions?: number;
  /** Whether to create parent directories */
  createDirectories?: boolean;
}

/**
 * Disk configuration
 */
export interface DiskConfig {
  /** Adapter type */
  adapter: "local" | "memory";
  /** Base path for local adapter */
  basePath?: string;
  /** Base URL for generating public URLs */
  baseUrl?: string;
}

/**
 * Storage module options
 */
export interface StorageOptions {
  /** Named disk configurations */
  disks: Record<string, DiskConfig>;
  /** Default disk name */
  default?: string;
}
