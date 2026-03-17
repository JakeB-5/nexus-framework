// @nexus/logger - File transport with rotation

import * as fs from "node:fs";
import * as path from "node:path";
import type { LogEntry, FileTransportOptions } from "../types.js";
import { BaseTransport } from "./transport.js";

/**
 * File transport - writes log entries to a file with optional rotation.
 *
 * Rotation works by checking file size before each write.
 * When maxSize is exceeded, the current file is renamed with a numeric suffix
 * and a new file is created.
 */
export class FileTransport extends BaseTransport {
  readonly name = "file";
  private readonly filePath: string;
  private readonly maxSize: number;
  private readonly maxFiles: number;
  private fd: number | null = null;
  private currentSize = 0;

  constructor(options: FileTransportOptions) {
    super(options);
    this.filePath = path.resolve(options.filePath);
    this.maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles ?? 5;
    this.ensureDirectory();
    this.openFile();
  }

  protected writeEntry(_entry: LogEntry, formatted: string): void {
    if (this.fd === null) {
      this.openFile();
    }

    const data = formatted + "\n";
    const bytes = Buffer.byteLength(data, "utf-8");

    // Check if rotation is needed
    if (this.currentSize + bytes > this.maxSize) {
      this.rotate();
    }

    try {
      fs.writeSync(this.fd!, data);
      this.currentSize += bytes;
    } catch {
      // If write fails, try reopening
      this.openFile();
      try {
        fs.writeSync(this.fd!, data);
        this.currentSize += bytes;
      } catch {
        // Give up silently - logging shouldn't crash the app
      }
    }
  }

  flush(): void {
    if (this.fd !== null) {
      try {
        fs.fsyncSync(this.fd);
      } catch {
        // Ignore flush errors
      }
    }
  }

  close(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        // Ignore close errors
      }
      this.fd = null;
    }
  }

  private openFile(): void {
    this.close();
    try {
      this.fd = fs.openSync(this.filePath, "a");
      try {
        const stats = fs.fstatSync(this.fd);
        this.currentSize = stats.size;
      } catch {
        this.currentSize = 0;
      }
    } catch {
      this.fd = null;
      this.currentSize = 0;
    }
  }

  private rotate(): void {
    this.close();

    // Remove oldest file if it exists
    const oldest = `${this.filePath}.${this.maxFiles}`;
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }

    // Shift existing rotated files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const from = `${this.filePath}.${i}`;
      const to = `${this.filePath}.${i + 1}`;
      if (fs.existsSync(from)) {
        fs.renameSync(from, to);
      }
    }

    // Rename current file to .1
    if (fs.existsSync(this.filePath)) {
      fs.renameSync(this.filePath, `${this.filePath}.1`);
    }

    this.openFile();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
