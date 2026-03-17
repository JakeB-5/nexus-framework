// @nexus/http - Type definitions
import type { IncomingMessage, ServerResponse } from "node:http";

// Re-export core types locally for when @nexus/core is building in parallel
export interface OnInit {
  onInit(): Promise<void> | void;
}

export interface OnDestroy {
  onDestroy(): Promise<void> | void;
}

export interface HttpServerOptions {
  port?: number;
  host?: string;
  keepAliveTimeout?: number;
  requestTimeout?: number;
  maxHeaderSize?: number;
  trustProxy?: boolean;
}

export interface CookieOptions {
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  maxAge?: number;
  expires?: Date;
  signed?: boolean;
}

export interface ParsedCookie {
  name: string;
  value: string;
}

export interface BodyParserOptions {
  limit?: number;
  encoding?: BufferEncoding;
}

export interface JsonBodyParserOptions extends BodyParserOptions {
  strict?: boolean;
}

export interface UrlEncodedBodyParserOptions extends BodyParserOptions {
  extended?: boolean;
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE"
  | "CONNECT";

export type NextFunction = (error?: Error) => void;

export type MiddlewareFunction = (
  req: NexusRequestInterface,
  res: NexusResponseInterface,
  next: NextFunction,
) => void | Promise<void>;

export type ErrorMiddlewareFunction = (
  error: Error,
  req: NexusRequestInterface,
  res: NexusResponseInterface,
  next: NextFunction,
) => void | Promise<void>;

export type MiddlewareEntry = MiddlewareFunction | ErrorMiddlewareFunction;

export interface NexusRequestInterface {
  readonly raw: IncomingMessage;
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly ip: string;
  readonly cookies: Record<string, string>;
  params: Record<string, string>;
  body(): Promise<unknown>;
  get(header: string): string | undefined;
}

export interface NexusResponseInterface {
  readonly raw: ServerResponse;
  readonly headersSent: boolean;
  readonly statusCode: number;
  status(code: number): NexusResponseInterface;
  header(name: string, value: string | string[]): NexusResponseInterface;
  json(data: unknown): void;
  text(data: string): void;
  html(data: string): void;
  redirect(url: string, statusCode?: number): void;
  cookie(name: string, value: string, options?: CookieOptions): NexusResponseInterface;
  stream(readable: NodeJS.ReadableStream): void;
  send(data: unknown): void;
  end(): void;
}
