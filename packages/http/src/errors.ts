// @nexus/http - HTTP error classes

import { NexusError } from "@nexus/core";

export class HttpError extends NexusError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number, code?: string, context?: Record<string, unknown>) {
    super(message, { code: code ?? `HTTP_${statusCode}`, context });
    this.name = "HttpError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      ...(this.context ? { context: this.context } : {}),
    };
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request", context?: Record<string, unknown>) {
    super(message, 400, "BAD_REQUEST", context);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", context?: Record<string, unknown>) {
    super(message, 401, "UNAUTHORIZED", context);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", context?: Record<string, unknown>) {
    super(message, 403, "FORBIDDEN", context);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found", context?: Record<string, unknown>) {
    super(message, 404, "NOT_FOUND", context);
    this.name = "NotFoundError";
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message = "Method Not Allowed", context?: Record<string, unknown>) {
    super(message, 405, "METHOD_NOT_ALLOWED", context);
    this.name = "MethodNotAllowedError";
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "Internal Server Error", context?: Record<string, unknown>) {
    super(message, 500, "INTERNAL_SERVER_ERROR", context);
    this.name = "InternalServerError";
  }
}
