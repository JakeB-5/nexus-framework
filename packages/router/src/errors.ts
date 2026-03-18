// @nexus/router - Error classes

import { NexusError } from "@nexus/core";

export class RouteNotFoundError extends NexusError {
  public readonly statusCode = 404;
  public readonly path: string;
  public readonly method: string;

  constructor(method: string, path: string) {
    super(`Route not found: ${method} ${path}`, { code: "ROUTE_NOT_FOUND" });
    this.name = "RouteNotFoundError";
    this.path = path;
    this.method = method;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MethodNotAllowedError extends NexusError {
  public readonly statusCode = 405;
  public readonly path: string;
  public readonly method: string;
  public readonly allowedMethods: string[];

  constructor(method: string, path: string, allowedMethods: string[]) {
    super(`Method ${method} not allowed for ${path}. Allowed: ${allowedMethods.join(", ")}`, { code: "METHOD_NOT_ALLOWED" });
    this.name = "MethodNotAllowedError";
    this.path = path;
    this.method = method;
    this.allowedMethods = allowedMethods;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
