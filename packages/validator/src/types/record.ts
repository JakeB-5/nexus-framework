// @nexus/validator - Record schema

import { Schema, fail, typeOf } from "../schema.js";
import { ValidationError } from "../errors.js";
import type { ValidationIssue } from "../errors.js";

export class RecordSchema<K extends string, V> extends Schema<Record<K, V>> {
  constructor(
    private readonly _keySchema: Schema<K>,
    private readonly _valueSchema: Schema<V>,
  ) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): Record<K, V> {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      fail("invalid_type", "Expected object, received " + typeOf(data), path, {
        expected: "object",
        received: typeOf(data),
      });
    }

    const input = data as Record<string, unknown>;
    const issues: ValidationIssue[] = [];
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(input)) {
      // Validate key
      try {
        const validatedKey = this._keySchema._parse(key, [...path, key]);
        // Validate value
        try {
          result[validatedKey as string] = this._valueSchema._parse(
            input[key],
            [...path, key],
          );
        } catch (error) {
          if (error instanceof ValidationError) {
            issues.push(...error.issues);
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(...error.issues);
        } else {
          throw error;
        }
      }
    }

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    return result as Record<K, V>;
  }
}
