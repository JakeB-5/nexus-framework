// @nexus/openapi - Spec validation

import { SpecValidationError } from "./errors.js";
import type { OpenApiSpec, OperationObject, PathItemObject } from "./types.js";

/**
 * Validate an OpenAPI 3.1 specification
 */
export function validateSpec(spec: OpenApiSpec): string[] {
  const errors: string[] = [];

  // Required fields
  if (!spec.openapi) {
    errors.push("Missing required field: openapi");
  } else if (!spec.openapi.startsWith("3.")) {
    errors.push(`Unsupported OpenAPI version: ${spec.openapi}`);
  }

  if (!spec.info) {
    errors.push("Missing required field: info");
  } else {
    if (!spec.info.title) {
      errors.push("Missing required field: info.title");
    }
    if (!spec.info.version) {
      errors.push("Missing required field: info.version");
    }
  }

  if (!spec.paths || typeof spec.paths !== "object") {
    errors.push("Missing required field: paths");
  } else {
    // Validate paths
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!path.startsWith("/")) {
        errors.push(`Path must start with /: ${path}`);
      }
      validatePathItem(path, pathItem, spec, errors);
    }
  }

  // Validate $ref references
  validateReferences(spec, errors);

  return errors;
}

/**
 * Validate and throw if errors found
 */
export function assertValidSpec(spec: OpenApiSpec): void {
  const errors = validateSpec(spec);
  if (errors.length > 0) {
    throw new SpecValidationError(errors);
  }
}

function validatePathItem(
  path: string,
  pathItem: PathItemObject,
  spec: OpenApiSpec,
  errors: string[],
): void {
  const methods = ["get", "post", "put", "delete", "patch", "head", "options", "trace"] as const;

  for (const method of methods) {
    const operation = pathItem[method];
    if (operation) {
      validateOperation(path, method, operation, spec, errors);
    }
  }
}

function validateOperation(
  path: string,
  method: string,
  operation: OperationObject,
  _spec: OpenApiSpec,
  errors: string[],
): void {
  const prefix = `${method.toUpperCase()} ${path}`;

  // Must have at least one response
  if (!operation.responses || Object.keys(operation.responses).length === 0) {
    errors.push(`${prefix}: must have at least one response`);
  }

  // Validate response status codes
  if (operation.responses) {
    for (const status of Object.keys(operation.responses)) {
      if (status !== "default" && !/^[1-5]\d{2}$/.test(status)) {
        errors.push(`${prefix}: invalid status code "${status}"`);
      }
    }
  }

  // Check for duplicate parameter names
  if (operation.parameters) {
    const paramKeys = new Set<string>();
    for (const param of operation.parameters) {
      const key = `${param.in}:${param.name}`;
      if (paramKeys.has(key)) {
        errors.push(`${prefix}: duplicate parameter "${param.name}" in "${param.in}"`);
      }
      paramKeys.add(key);

      // Path params must be required
      if (param.in === "path" && !param.required) {
        errors.push(`${prefix}: path parameter "${param.name}" must be required`);
      }
    }
  }

  // Validate path parameters are defined
  const pathParams = extractParamsFromPath(path);
  if (operation.parameters) {
    const definedPathParams = new Set(
      operation.parameters.filter((p) => p.in === "path").map((p) => p.name),
    );
    for (const param of pathParams) {
      if (!definedPathParams.has(param)) {
        errors.push(`${prefix}: path parameter "{${param}}" not defined in parameters`);
      }
    }
  } else if (pathParams.length > 0) {
    errors.push(`${prefix}: path has parameters but none are defined`);
  }
}

function validateReferences(spec: OpenApiSpec, errors: string[]): void {
  const json = JSON.stringify(spec);
  const refPattern = /"\$ref"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = refPattern.exec(json)) !== null) {
    const ref = match[1];
    if (ref.startsWith("#/")) {
      const resolved = resolveLocalRef(spec, ref);
      if (resolved === undefined) {
        errors.push(`Unresolved $ref: ${ref}`);
      }
    }
  }
}

function resolveLocalRef(spec: OpenApiSpec, ref: string): unknown {
  const parts = ref.replace("#/", "").split("/");
  let current: unknown = spec;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function extractParamsFromPath(path: string): string[] {
  const params: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  return params;
}
