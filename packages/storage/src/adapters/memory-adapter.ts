// @nexus/storage - In-memory storage adapter (for testing)

import { StorageAdapter } from "./adapter.js";
import type { FileInfo, FileStat, WriteOptions } from "../types.js";
import { FileNotFoundError } from "../errors.js";
import { sanitizePath, getMimeType } from "../path-utils.js";

interface MemoryEntry {
  content: Buffer;
  contentType: string;
  createdAt: Date;
  lastModified: Date;
}

/**
 * In-memory storage adapter backed by a Map.
 * Full API compliance, useful for testing.
 */
export class MemoryAdapter extends StorageAdapter {
  private readonly _files: Map<string, MemoryEntry> = new Map();

  async read(path: string): Promise<Buffer> {
    const safePath = sanitizePath(path);
    const entry = this._files.get(safePath);
    if (!entry) {
      throw new FileNotFoundError(safePath);
    }
    return Buffer.from(entry.content);
  }

  async write(path: string, content: Buffer | string, options?: WriteOptions): Promise<void> {
    const safePath = sanitizePath(path);
    const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    const existing = this._files.get(safePath);

    this._files.set(safePath, {
      content: buf,
      contentType: options?.contentType ?? getMimeType(safePath),
      createdAt: existing?.createdAt ?? new Date(),
      lastModified: new Date(),
    });
  }

  async delete(path: string): Promise<boolean> {
    const safePath = sanitizePath(path);
    return this._files.delete(safePath);
  }

  async exists(path: string): Promise<boolean> {
    const safePath = sanitizePath(path);
    return this._files.has(safePath);
  }

  async copy(from: string, to: string): Promise<void> {
    const safeFrom = sanitizePath(from);
    const safeTo = sanitizePath(to);
    const entry = this._files.get(safeFrom);
    if (!entry) {
      throw new FileNotFoundError(safeFrom);
    }
    this._files.set(safeTo, {
      content: Buffer.from(entry.content),
      contentType: entry.contentType,
      createdAt: new Date(),
      lastModified: new Date(),
    });
  }

  async move(from: string, to: string): Promise<void> {
    await this.copy(from, to);
    await this.delete(from);
  }

  async list(prefix?: string): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    const safePrefix = prefix ? sanitizePath(prefix) : "";

    for (const [path, entry] of this._files) {
      if (!safePrefix || path.startsWith(safePrefix)) {
        results.push({
          path,
          size: entry.content.length,
          lastModified: entry.lastModified,
          isDirectory: false,
        });
      }
    }

    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  async stat(path: string): Promise<FileStat> {
    const safePath = sanitizePath(path);
    const entry = this._files.get(safePath);
    if (!entry) {
      throw new FileNotFoundError(safePath);
    }

    return {
      path: safePath,
      size: entry.content.length,
      lastModified: entry.lastModified,
      createdAt: entry.createdAt,
      isDirectory: false,
      isFile: true,
      mimeType: entry.contentType,
    };
  }

  /**
   * Get the number of stored files (for testing)
   */
  get fileCount(): number {
    return this._files.size;
  }

  /**
   * Clear all files (for testing)
   */
  clear(): void {
    this._files.clear();
  }
}
