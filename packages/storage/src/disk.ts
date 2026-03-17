// @nexus/storage - Disk class (main API)

import type { StorageAdapter } from "./adapters/adapter.js";
import type { FileInfo, FileStat, WriteOptions } from "./types.js";

/**
 * Disk - high-level storage API wrapping an adapter.
 * Provides a clean interface for file operations.
 */
export class Disk {
  private readonly _baseUrl: string;

  constructor(
    private readonly _name: string,
    private readonly _adapter: StorageAdapter,
    options: { baseUrl?: string } = {},
  ) {
    this._baseUrl = options.baseUrl ?? "";
  }

  /**
   * Get the disk name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Read a file as Buffer
   */
  async read(path: string): Promise<Buffer> {
    return this._adapter.read(path);
  }

  /**
   * Read a file as string
   */
  async readString(path: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    const buf = await this._adapter.read(path);
    return buf.toString(encoding);
  }

  /**
   * Write content to a file
   */
  async write(path: string, content: Buffer | string, options?: WriteOptions): Promise<void> {
    return this._adapter.write(path, content, options);
  }

  /**
   * Delete a file
   */
  async delete(path: string): Promise<boolean> {
    return this._adapter.delete(path);
  }

  /**
   * Check if a file exists
   */
  async exists(path: string): Promise<boolean> {
    return this._adapter.exists(path);
  }

  /**
   * Copy a file
   */
  async copy(from: string, to: string): Promise<void> {
    return this._adapter.copy(from, to);
  }

  /**
   * Move a file
   */
  async move(from: string, to: string): Promise<void> {
    return this._adapter.move(from, to);
  }

  /**
   * List files, optionally filtered by prefix
   */
  async list(prefix?: string): Promise<FileInfo[]> {
    return this._adapter.list(prefix);
  }

  /**
   * Get file statistics
   */
  async stat(path: string): Promise<FileStat> {
    return this._adapter.stat(path);
  }

  /**
   * Get public URL for a file
   */
  url(path: string): string {
    if (!this._baseUrl) {
      return path;
    }
    const base = this._baseUrl.replace(/\/$/, "");
    const clean = path.replace(/^\//, "");
    return `${base}/${clean}`;
  }

  /**
   * Get a temporary signed URL (simplified - adds expiry param)
   */
  temporaryUrl(path: string, expirySeconds: number): string {
    const baseUrl = this.url(path);
    const expires = Math.floor(Date.now() / 1000) + expirySeconds;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}expires=${expires}`;
  }

  /**
   * Get the underlying adapter
   */
  getAdapter(): StorageAdapter {
    return this._adapter;
  }
}
