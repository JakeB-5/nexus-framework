// @nexus/orm - Error types

/**
 * Base ORM error
 */
export class OrmError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    options: { code?: string; cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "OrmError";
    this.code = options.code ?? "ORM_ERROR";
    this.context = options.context ?? {};
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Base error for query-related failures
 */
export class QueryError extends OrmError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, { code: "QUERY_ERROR", ...options });
    this.name = "QueryError";
  }
}

/**
 * Error for database connection failures
 */
export class ConnectionError extends OrmError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, { code: "CONNECTION_ERROR", ...options });
    this.name = "ConnectionError";
  }
}

/**
 * Error for migration failures
 */
export class MigrationError extends OrmError {
  public readonly migrationName: string;

  constructor(
    migrationName: string,
    message?: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message ?? `Migration failed: ${migrationName}`, {
      code: "MIGRATION_ERROR",
      context: { migration: migrationName, ...options.context },
      cause: options.cause,
    });
    this.name = "MigrationError";
    this.migrationName = migrationName;
  }
}

/**
 * Error for model-related failures
 */
export class ModelError extends OrmError {
  constructor(
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {},
  ) {
    super(message, { code: "MODEL_ERROR", ...options });
    this.name = "ModelError";
  }
}
