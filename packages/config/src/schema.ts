// @nexus/config - Schema definition and validation

import type {
  ConfigSchema,
  ConfigSchemaProperty,
  ConfigValidationDetail,
} from "./types.js";
import { ConfigValidationError } from "./errors.js";

/**
 * Define a configuration schema.
 * Returns the schema object for use with ConfigService validation.
 */
export function defineConfig(schema: ConfigSchema): ConfigSchema {
  return schema;
}

/**
 * Extract default values from a schema definition.
 */
export function extractDefaults(
  schema: ConfigSchema,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(schema)) {
    if (prop.default !== undefined) {
      defaults[key] = prop.default;
    } else if (prop.type === "object" && prop.properties) {
      const nested = extractDefaults(prop.properties);
      if (Object.keys(nested).length > 0) {
        defaults[key] = nested;
      }
    }
  }

  return defaults;
}

/**
 * Validate a configuration object against a schema.
 * Returns an array of validation errors (empty if valid).
 */
export function validateConfig(
  config: Record<string, unknown>,
  schema: ConfigSchema,
  pathPrefix: string = "",
): ConfigValidationDetail[] {
  const errors: ConfigValidationDetail[] = [];

  for (const [key, prop] of Object.entries(schema)) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const value = config[key];

    // Check required
    if (prop.required && (value === undefined || value === null)) {
      errors.push({
        path: fullPath,
        message: "Required configuration value is missing",
        expected: prop.type,
        received: "undefined",
      });
      continue;
    }

    // Skip validation if value is undefined and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    const typeError = validateType(value, prop, fullPath);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // Nested object validation
    if (prop.type === "object" && prop.properties) {
      const nested = validateConfig(
        value as Record<string, unknown>,
        prop.properties,
        fullPath,
      );
      errors.push(...nested);
    }
  }

  return errors;
}

/**
 * Validate the type of a value against a schema property.
 */
function validateType(
  value: unknown,
  prop: ConfigSchemaProperty,
  path: string,
): ConfigValidationDetail | null {
  switch (prop.type) {
    case "string":
      if (typeof value !== "string") {
        return {
          path,
          message: `Expected string, got ${typeof value}`,
          expected: "string",
          received: typeof value,
        };
      }
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        return {
          path,
          message: `Expected number, got ${typeof value}`,
          expected: "number",
          received: typeof value,
        };
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return {
          path,
          message: `Expected boolean, got ${typeof value}`,
          expected: "boolean",
          received: typeof value,
        };
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        return {
          path,
          message: `Expected object, got ${Array.isArray(value) ? "array" : typeof value}`,
          expected: "object",
          received: Array.isArray(value) ? "array" : typeof value,
        };
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        return {
          path,
          message: `Expected array, got ${typeof value}`,
          expected: "array",
          received: typeof value,
        };
      }
      break;
  }
  return null;
}

/**
 * Validate config and throw if invalid.
 */
export function assertConfigValid(
  config: Record<string, unknown>,
  schema: ConfigSchema,
): void {
  const errors = validateConfig(config, schema);
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
}
