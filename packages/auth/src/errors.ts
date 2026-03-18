// Auth error classes

import { NexusError } from "@nexus/core";

export class AuthenticationError extends NexusError {
  public readonly statusCode: number = 401;

  constructor(message = "Authentication required") {
    super(message, { code: "AUTHENTICATION_ERROR" });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends NexusError {
  public readonly statusCode = 403;

  constructor(message = "Insufficient permissions") {
    super(message, { code: "AUTHORIZATION_ERROR" });
    this.name = "AuthorizationError";
  }
}

export class TokenExpiredError extends AuthenticationError {
  public readonly code = "TOKEN_EXPIRED";
  public readonly expiredAt: Date;

  constructor(message = "Token has expired", expiredAt?: Date) {
    super(message);
    this.name = "TokenExpiredError";
    this.expiredAt = expiredAt ?? new Date();
  }
}

export class InvalidTokenError extends AuthenticationError {
  public readonly code = "INVALID_TOKEN";

  constructor(message = "Invalid token") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export class TokenNotBeforeError extends AuthenticationError {
  public readonly code = "TOKEN_NOT_BEFORE";
  public readonly date: Date;

  constructor(message = "Token not yet valid", date?: Date) {
    super(message);
    this.name = "TokenNotBeforeError";
    this.date = date ?? new Date();
  }
}
