// @nexus/storage - Local filesystem adapter

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { StorageAdapter } from "./adapter.js";
import type { FileInfo, FileStat, WriteOptions } from "../types.js";
import { FileNotFoundError, StorageError } from "../errors.js";
import { sanitizePath, getMimeType } from "../path-utils.js";

/**
 * Local filesystem storage adapter.
 * All paths are relative to the configured basePath.
 */
export class LocalAdapter extends StorageAdapter {
  constructor(private readonly _basePath: string) {
    super();
  }

  private _resolve(filePath: string): string {
    const safe = sanitizePath(filePath);
    return path.join(this._basePath, safe);
  }

  async read(filePath: string): Promise<Buffer> {
    const fullPath = this._resolve(filePath);
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if (this._isNotFound(error)) {
        throw new FileNotFoundError(filePath);
      }
      throw new StorageError(`Failed to read file: ${filePath}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async write(filePath: string, content: Buffer | string, options?: WriteOptions): Promise<void> {
    const fullPath = this._resolve(filePath);

    // Create parent directories if needed
    if (options?.createDirectories !== false) {
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
    }

    try {
      await fs.writeFile(fullPath, content);

      if (options?.permissions) {
        await fs.chmod(fullPath, options.permissions);
      }
    } catch (error) {
      throw new StorageError(`Failed to write file: ${filePath}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async delete(filePath: string): Promise<boolean> {
    const fullPath = this._resolve(filePath);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      if (this._isNotFound(error)) {
        return false;
      }
      throw new StorageError(`Failed to delete file: ${filePath}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this._resolve(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async copy(from: string, to: string): Promise<void> {
    const fullFrom = this._resolve(from);
    const fullTo = this._resolve(to);

    // Ensure target directory exists
    await fs.mkdir(path.dirname(fullTo), { recursive: true });

    try {
      await fs.copyFile(fullFrom, fullTo);
    } catch (error) {
      if (this._isNotFound(error)) {
        throw new FileNotFoundError(from);
      }
      throw new StorageError(`Failed to copy ${from} to ${to}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async move(from: string, to: string): Promise<void> {
    const fullFrom = this._resolve(from);
    const fullTo = this._resolve(to);

    await fs.mkdir(path.dirname(fullTo), { recursive: true });

    try {
      await fs.rename(fullFrom, fullTo);
    } catch (error) {
      if (this._isNotFound(error)) {
        throw new FileNotFoundError(from);
      }
      throw new StorageError(`Failed to move ${from} to ${to}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async list(prefix?: string): Promise<FileInfo[]> {
    const dir = prefix ? this._resolve(prefix) : this._basePath;
    const results: FileInfo[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = prefix ? `${sanitizePath(prefix)}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);
        const stats = await fs.stat(fullPath);

        results.push({
          path: entryPath,
          size: stats.size,
          lastModified: stats.mtime,
          isDirectory: entry.isDirectory(),
        });
      }
    } catch (error) {
      if (this._isNotFound(error)) {
        return [];
      }
      throw new StorageError(`Failed to list directory: ${prefix ?? "/"}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }

    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  async stat(filePath: string): Promise<FileStat> {
    const fullPath = this._resolve(filePath);
    try {
      const stats = await fs.stat(fullPath);
      return {
        path: sanitizePath(filePath),
        size: stats.size,
        lastModified: stats.mtime,
        createdAt: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        mimeType: getMimeType(filePath),
      };
    } catch (error) {
      if (this._isNotFound(error)) {
        throw new FileNotFoundError(filePath);
      }
      throw new StorageError(`Failed to stat file: ${filePath}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private _isNotFound(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    );
  }
}
