// Auth error classes

export class AuthenticationError extends Error {
  public readonly code: string = "AUTHENTICATION_ERROR";
  public readonly statusCode: number = 401;

  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  public readonly code = "AUTHORIZATION_ERROR";
  public readonly statusCode = 403;

  constructor(message = "Insufficient permissions") {
    super(message);
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
