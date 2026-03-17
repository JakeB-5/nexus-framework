// @nexus/testing - Custom test matchers

import type { MatcherResult, TestResponse } from "./types.js";

/**
 * Assert a test response has a valid status
 */
export function toBeValidResponse(response: TestResponse, expectedStatus?: number): MatcherResult {
  if (expectedStatus !== undefined) {
    return {
      pass: response.status === expectedStatus,
      message: `Expected status ${expectedStatus}, got ${response.status}`,
    };
  }
  return {
    pass: response.status >= 200 && response.status < 500,
    message: `Expected valid response status, got ${response.status}`,
  };
}

/**
 * Assert a response has a specific header
 */
export function toHaveHeader(response: TestResponse, name: string, value?: string): MatcherResult {
  const headerValue = response.headers[name.toLowerCase()];
  if (headerValue === undefined) {
    return { pass: false, message: `Header "${name}" not found` };
  }
  if (value !== undefined && headerValue !== value) {
    return {
      pass: false,
      message: `Expected header "${name}" to be "${value}", got "${headerValue}"`,
    };
  }
  return { pass: true, message: `Header "${name}" is present` };
}

/**
 * Assert an object matches a schema shape
 */
export function toMatchSchema(
  value: unknown,
  schema: { type?: string; properties?: Record<string, { type?: string }>; required?: string[] },
): MatcherResult {
  if (schema.type) {
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (schema.type === "integer") {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return { pass: false, message: `Expected integer, got ${typeof value}` };
      }
    } else if (schema.type === "array") {
      if (!Array.isArray(value)) {
        return { pass: false, message: `Expected array, got ${actualType}` };
      }
    } else if (actualType !== schema.type) {
      return { pass: false, message: `Expected type "${schema.type}", got "${actualType}"` };
    }
  }

  if (schema.required && typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required) {
      if (!(key in obj)) {
        return { pass: false, message: `Missing required property: "${key}"` };
      }
    }
  }

  if (schema.properties && typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in obj && propSchema.type) {
        const propType = typeof obj[key];
        if (propSchema.type === "integer") {
          if (typeof obj[key] !== "number" || !Number.isInteger(obj[key])) {
            return { pass: false, message: `Property "${key}": expected integer` };
          }
        } else if (propType !== propSchema.type) {
          return { pass: false, message: `Property "${key}": expected "${propSchema.type}", got "${propType}"` };
        }
      }
    }
  }

  return { pass: true, message: "Schema matched" };
}

/**
 * Assert an object contains a specific key-value entry
 */
export function toContainEntry(obj: Record<string, unknown>, key: string, value: unknown): MatcherResult {
  if (!(key in obj)) {
    return { pass: false, message: `Object does not contain key "${key}"` };
  }
  if (obj[key] !== value) {
    return {
      pass: false,
      message: `Expected "${key}" to be ${JSON.stringify(value)}, got ${JSON.stringify(obj[key])}`,
    };
  }
  return { pass: true, message: `Object contains "${key}": ${JSON.stringify(value)}` };
}

/**
 * Assert a number is within a range
 */
export function toBeWithinRange(value: number, min: number, max: number): MatcherResult {
  return {
    pass: value >= min && value <= max,
    message: `Expected ${value} to be within [${min}, ${max}]`,
  };
}

/**
 * Assert value satisfies a custom predicate
 */
export function toSatisfy<T>(value: T, predicate: (v: T) => boolean, description?: string): MatcherResult {
  return {
    pass: predicate(value),
    message: description ?? `Value did not satisfy predicate`,
  };
}
