// @nexus/openapi - Error types

import { NexusError } from "@nexus/core";

export class OpenApiError extends NexusError {
  constructor(message: string, code?: string) {
    super(message, { code: code ?? "OPENAPI_ERROR" });
    this.name = "OpenApiError";
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
