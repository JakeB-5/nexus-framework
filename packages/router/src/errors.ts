// @nexus/router - Error classes

export class RouteNotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = "ROUTE_NOT_FOUND";
  public readonly path: string;
  public readonly method: string;

  constructor(method: string, path: string) {
    super(`Route not found: ${method} ${path}`);
    this.name = "RouteNotFoundError";
    this.path = path;
    this.method = method;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MethodNotAllowedError extends Error {
  public readonly statusCode = 405;
  public readonly code = "METHOD_NOT_ALLOWED";
  public readonly path: string;
  public readonly method: string;
  public readonly allowedMethods: string[];

  constructor(method: string, path: string, allowedMethods: string[]) {
    super(`Method ${method} not allowed for ${path}. Allowed: ${allowedMethods.join(", ")}`);
    this.name = "MethodNotAllowedError";
    this.path = path;
    this.method = method;
    this.allowedMethods = allowedMethods;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
