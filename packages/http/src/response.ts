// @nexus/http - NexusResponse wrapping ServerResponse
import type { ServerResponse } from "node:http";
import { serializeCookie } from "./cookie.js";
import type { CookieOptions, NexusResponseInterface } from "./types.js";

export class NexusResponse implements NexusResponseInterface {
  public readonly raw: ServerResponse;
  private _statusCode = 200;

  constructor(raw: ServerResponse) {
    this.raw = raw;
  }

  get headersSent(): boolean {
    return this.raw.headersSent;
  }

  get statusCode(): number {
    return this._statusCode;
  }

  status(code: number): NexusResponse {
    this._statusCode = code;
    this.raw.statusCode = code;
    return this;
  }

  header(name: string, value: string | string[]): NexusResponse {
    this.raw.setHeader(name, value);
    return this;
  }

  json(data: unknown): void {
    const body = JSON.stringify(data);
    this.header("Content-Type", "application/json; charset=utf-8");
    this.header("Content-Length", Buffer.byteLength(body).toString());
    this.raw.statusCode = this._statusCode;
    this.raw.end(body);
  }

  text(data: string): void {
    this.header("Content-Type", "text/plain; charset=utf-8");
    this.header("Content-Length", Buffer.byteLength(data).toString());
    this.raw.statusCode = this._statusCode;
    this.raw.end(data);
  }

  html(data: string): void {
    this.header("Content-Type", "text/html; charset=utf-8");
    this.header("Content-Length", Buffer.byteLength(data).toString());
    this.raw.statusCode = this._statusCode;
    this.raw.end(data);
  }

  redirect(url: string, statusCode = 302): void {
    this.status(statusCode);
    this.header("Location", url);
    this.raw.end();
  }

  cookie(name: string, value: string, options?: CookieOptions): NexusResponse {
    const serialized = serializeCookie(name, value, options);
    const existing = this.raw.getHeader("Set-Cookie");
    if (existing) {
      const cookies = Array.isArray(existing) ? existing : [String(existing)];
      cookies.push(serialized);
      this.raw.setHeader("Set-Cookie", cookies);
    } else {
      this.raw.setHeader("Set-Cookie", serialized);
    }
    return this;
  }

  stream(readable: NodeJS.ReadableStream): void {
    this.raw.statusCode = this._statusCode;
    readable.pipe(this.raw);
  }

  send(data: unknown): void {
    if (data === null || data === undefined) {
      this.raw.statusCode = this._statusCode;
      this.raw.end();
      return;
    }

    if (typeof data === "string") {
      // Detect HTML
      if (data.startsWith("<!DOCTYPE") || data.startsWith("<html")) {
        this.html(data);
      } else {
        this.text(data);
      }
      return;
    }

    if (Buffer.isBuffer(data)) {
      this.header("Content-Type", "application/octet-stream");
      this.header("Content-Length", data.length.toString());
      this.raw.statusCode = this._statusCode;
      this.raw.end(data);
      return;
    }

    // Object/Array - send as JSON
    this.json(data);
  }

  end(): void {
    this.raw.statusCode = this._statusCode;
    this.raw.end();
  }
}
