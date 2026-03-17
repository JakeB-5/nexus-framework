/**
 * Error Handler Middleware
 *
 * In @nexus/http, error handling is centralized through the
 * error handler middleware and typed HTTP exceptions:
 *
 *   app.use(errorHandler({
 *     includeStack: config.isDev,
 *     onError: (err) => logger.error(err),
 *   }));
 *
 *   // In handlers, throw typed exceptions:
 *   throw new NotFoundException('Todo not found');
 *   throw new UnauthorizedException('Invalid token');
 *
 * This implementation provides the same patterns with custom
 * error classes and a catch-all error handler.
 */

import type { ServerResponse } from "node:http";
import { logger } from "./logger.js";

// ---------------------------------------------------------------------------
// HTTP Exception classes - mirrors @nexus/http exceptions
// ---------------------------------------------------------------------------

/**
 * Base HTTP exception. All application errors should extend this.
 * @nexus/http exports these from '@nexus/http/exceptions'.
 */
export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpException";
  }
}

/** 400 Bad Request - invalid input or malformed request */
export class BadRequestException extends HttpException {
  constructor(message = "Bad Request", details?: unknown) {
    super(400, message, details);
    this.name = "BadRequestException";
  }
}

/** 401 Unauthorized - missing or invalid authentication */
export class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedException";
  }
}

/** 403 Forbidden - authenticated but not allowed */
export class ForbiddenException extends HttpException {
  constructor(message = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenException";
  }
}

/** 404 Not Found - resource does not exist */
export class NotFoundException extends HttpException {
  constructor(message = "Not Found") {
    super(404, message);
    this.name = "NotFoundException";
  }
}

/** 409 Conflict - duplicate resource or state conflict */
export class ConflictException extends HttpException {
  constructor(message = "Conflict", details?: unknown) {
    super(409, message, details);
    this.name = "ConflictException";
  }
}

/** 422 Unprocessable Entity - validation failed */
export class ValidationException extends HttpException {
  constructor(
    message = "Validation Failed",
    public readonly errors: ValidationError[],
  ) {
    super(422, message, errors);
    this.name = "ValidationException";
  }
}

/** Individual field validation error */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// ---------------------------------------------------------------------------
// Error response shape
// ---------------------------------------------------------------------------

interface ErrorResponse {
  error: {
    status: number;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Error handler - catches all errors and sends appropriate responses
// ---------------------------------------------------------------------------

export function handleError(error: unknown, res: ServerResponse): void {
  // Known HTTP exceptions
  if (error instanceof HttpException) {
    const response: ErrorResponse = {
      error: {
        status: error.statusCode,
        message: error.message,
        timestamp: new Date().toISOString(),
      },
    };

    // Include validation details for 422 errors
    if (error instanceof ValidationException) {
      response.error.details = error.errors;
    } else if (error.details) {
      response.error.details = error.details;
    }

    // Log 5xx errors as errors, 4xx as warnings
    if (error.statusCode >= 500) {
      logger.error(`[${error.statusCode}] ${error.message}`);
    } else {
      logger.warn(`[${error.statusCode}] ${error.message}`);
    }

    sendJson(res, error.statusCode, response);
    return;
  }

  // Unknown errors - treat as 500 Internal Server Error
  const message = error instanceof Error ? error.message : "Internal Server Error";
  logger.error(`[500] Unhandled error: ${message}`, {
    stack: error instanceof Error ? error.stack : undefined,
  });

  const response: ErrorResponse = {
    error: {
      status: 500,
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
    },
  };

  sendJson(res, 500, response);
}
