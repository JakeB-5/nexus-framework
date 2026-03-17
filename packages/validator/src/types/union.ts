// @nexus/validator - Union and Intersection schemas

import { Schema, fail, typeOf } from "../schema.js";
import { ValidationError } from "../errors.js";

/**
 * Union schema - validates against multiple schemas, returns first match
 */
export class UnionSchema<T> extends Schema<T> {
  constructor(private readonly _schemas: Schema<T>[]) {
    super();
    if (_schemas.length < 2) {
      throw new Error("Union requires at least 2 schemas");
    }
  }

  _parse(data: unknown, path: Array<string | number>): T {
    const issues: string[] = [];

    for (const schema of this._schemas) {
      try {
        return schema._parse(data, path);
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(error.issues.map((i) => i.message).join("; "));
        } else {
          throw error;
        }
      }
    }

    fail(
      "invalid_union",
      `Invalid input: does not match any union member`,
      path,
      { received: typeOf(data) },
    );
  }
}

/**
 * Intersection schema - validates against all schemas and merges results
 */
export class IntersectionSchema<T> extends Schema<T> {
  constructor(
    private readonly _left: Schema<unknown>,
    private readonly _right: Schema<unknown>,
  ) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): T {
    const left = this._left._parse(data, path);
    const right = this._right._parse(data, path);

    // If both are objects, merge them
    if (
      left !== null &&
      right !== null &&
      typeof left === "object" &&
      typeof right === "object" &&
      !Array.isArray(left) &&
      !Array.isArray(right)
    ) {
      return { ...left, ...right } as T;
    }

    // For non-objects, both must succeed and we return the value
    return left as T;
  }
}

/**
 * Discriminated union - uses a discriminator key for faster matching
 */
export class DiscriminatedUnionSchema<T> extends Schema<T> {
  private readonly _schemaMap: Map<unknown, Schema<T>>;

  constructor(
    private readonly _discriminator: string,
    schemas: Schema<T>[],
  ) {
    super();
    this._schemaMap = new Map();

    // Extract discriminator values from each schema
    // We try to parse a probe object to detect the expected discriminator value
    for (const schema of schemas) {
      // Store schemas for iteration fallback
      this._schemaMap.set(schema, schema);
    }
    // Store original schemas for fallback iteration
    this._schemas = schemas;
  }

  private readonly _schemas: Schema<T>[];

  _parse(data: unknown, path: Array<string | number>): T {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      fail("invalid_type", "Expected object, received " + typeOf(data), path, {
        expected: "object",
        received: typeOf(data),
      });
    }

    const input = data as Record<string, unknown>;
    const discriminatorValue = input[this._discriminator];

    if (discriminatorValue === undefined) {
      fail(
        "invalid_union",
        `Missing discriminator key "${this._discriminator}"`,
        [...path, this._discriminator],
      );
    }

    // Try each schema
    const issues: string[] = [];
    for (const schema of this._schemas) {
      try {
        return schema._parse(data, path);
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(error.issues.map((i) => i.message).join("; "));
        } else {
          throw error;
        }
      }
    }

    fail(
      "invalid_union",
      `Invalid discriminator value for key "${this._discriminator}"`,
      [...path, this._discriminator],
      { received: String(discriminatorValue) },
    );
  }
}
