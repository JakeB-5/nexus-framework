// @nexus/graphql - GraphQL error types

import type { GraphQLFormattedError } from "./types.js";

/**
 * Base GraphQL error with location tracking and path info
 */
export class GraphQLError extends Error {
  public readonly locations: Array<{ line: number; column: number }>;
  public readonly path: Array<string | number>;
  public readonly extensions: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    options: {
      locations?: Array<{ line: number; column: number }>;
      path?: Array<string | number>;
      extensions?: Record<string, unknown>;
      originalError?: Error;
    } = {},
  ) {
    super(message);
    this.name = "GraphQLError";
    this.locations = options.locations ?? [];
    this.path = options.path ?? [];
    this.extensions = options.extensions ?? {};
    this.originalError = options.originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): GraphQLFormattedError {
    const result: GraphQLFormattedError = { message: this.message };
    if (this.locations.length > 0) {
      result.locations = this.locations;
    }
    if (this.path.length > 0) {
      result.path = this.path;
    }
    if (Object.keys(this.extensions).length > 0) {
      result.extensions = this.extensions;
    }
    return result;
  }
}

/**
 * Error during SDL or query parsing
 */
export class GraphQLSyntaxError extends GraphQLError {
  constructor(
    message: string,
    location?: { line: number; column: number },
  ) {
    super(message, {
      locations: location ? [location] : [],
      extensions: { code: "GRAPHQL_PARSE_FAILED" },
    });
    this.name = "GraphQLSyntaxError";
  }
}

/**
 * Error during query validation
 */
export class GraphQLValidationError extends GraphQLError {
  constructor(
    message: string,
    locations?: Array<{ line: number; column: number }>,
  ) {
    super(message, {
      locations,
      extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
    });
    this.name = "GraphQLValidationError";
  }
}

/**
 * Error during query execution
 */
export class GraphQLExecutionError extends GraphQLError {
  constructor(
    message: string,
    path?: Array<string | number>,
    originalError?: Error,
  ) {
    super(message, {
      path,
      extensions: { code: "INTERNAL_SERVER_ERROR" },
      originalError,
    });
    this.name = "GraphQLExecutionError";
  }
}

/**
 * Error for schema building issues
 */
export class SchemaError extends Error {
  public readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "SchemaError";
    this.code = code ?? "SCHEMA_ERROR";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Collect and format errors for response
 */
export function formatErrors(errors: Array<GraphQLError | Error>): GraphQLFormattedError[] {
  return errors.map((err) => {
    if (err instanceof GraphQLError) {
      return err.toJSON();
    }
    return { message: err.message };
  });
}
