// @nexus/openapi - Error types

export class OpenApiError extends Error {
  public readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "OpenApiError";
    this.code = code ?? "OPENAPI_ERROR";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SpecValidationError extends OpenApiError {
  public readonly violations: string[];

  constructor(violations: string[]) {
    super(`OpenAPI spec has ${violations.length} validation error(s): ${violations[0]}`, "SPEC_VALIDATION_ERROR");
    this.name = "SpecValidationError";
    this.violations = violations;
  }
}
