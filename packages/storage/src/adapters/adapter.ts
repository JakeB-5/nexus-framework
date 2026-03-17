// @nexus/storage - StorageAdapter interface

import type { FileInfo, FileStat, WriteOptions } from "../types.js";

/**
 * Abstract storage adapter interface
 */
export abstract class StorageAdapter {
  abstract read(path: string): Promise<Buffer>;
  abstract write(path: string, content: Buffer | string, options?: WriteOptions): Promise<void>;
  abstract delete(path: string): Promise<boolean>;
  abstract exists(path: string): Promise<boolean>;
  abstract copy(from: string, to: string): Promise<void>;
  abstract move(from: string, to: string): Promise<void>;
  abstract list(prefix?: string): Promise<FileInfo[]>;
  abstract stat(path: string): Promise<FileStat>;
}
