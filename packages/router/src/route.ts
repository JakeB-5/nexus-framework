// @nexus/router - Route definition
import type { HandlerFunction, HttpMethod, RouteDefinition } from "./types.js";

export class Route implements RouteDefinition {
  public readonly method: HttpMethod;
  public readonly path: string;
  public readonly handlers: HandlerFunction[];
  public readonly name: string | undefined;
  public readonly metadata: Record<string, unknown>;

  constructor(
    method: HttpMethod,
    path: string,
    handlers: HandlerFunction[],
    options?: { name?: string; metadata?: Record<string, unknown> },
  ) {
    this.method = method;
    this.path = normalizePath(path);
    this.handlers = handlers;
    this.name = options?.name;
    this.metadata = options?.metadata ?? {};
  }
}

export function normalizePath(path: string): string {
  // Ensure leading slash
  let normalized = path.startsWith("/") ? path : `/${path}`;
  // Collapse multiple slashes
  normalized = normalized.replace(/\/+/g, "/");
  // Remove trailing slash (except root)
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function joinPaths(prefix: string, path: string): string {
  const p = normalizePath(prefix);
  const s = normalizePath(path);

  if (p === "/") {
    return s;
  }
  if (s === "/") {
    return p;
  }
  return normalizePath(`${p}${s}`);
}
