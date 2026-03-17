// @nexus/validator - Object schema

import { Schema, fail, typeOf } from "../schema.js";
import { ValidationError } from "../errors.js";
import type { ValidationIssue } from "../errors.js";
import type { ObjectShape, InferShape } from "../types.js";

type StripMode = "strip" | "strict" | "passthrough";

export class ObjectSchema<S extends ObjectShape> extends Schema<InferShape<S>> {
  private _stripMode: StripMode = "strip";

  constructor(private readonly _shape: S) {
    super();
  }

  get shape(): S {
    return this._shape;
  }

  _parse(data: unknown, path: Array<string | number>): InferShape<S> {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      fail("invalid_type", "Expected object, received " + typeOf(data), path, {
        expected: "object",
        received: typeOf(data),
      });
    }

    const input = data as Record<string, unknown>;
    const issues: ValidationIssue[] = [];
    const result: Record<string, unknown> = {};

    // Validate known keys - use parse() to handle optional/nullable/default
    for (const key of Object.keys(this._shape)) {
      try {
        const schema = this._shape[key];
        result[key] = schema.parse(input[key]);
      } catch (error) {
        if (error instanceof ValidationError) {
          // Prepend the current path to each issue
          for (const issue of error.issues) {
            issues.push({
              ...issue,
              path: [...path, key, ...issue.path],
            });
          }
        } else {
          throw error;
        }
      }
    }

    // Handle unknown keys
    const shapeKeys = new Set(Object.keys(this._shape));
    const unknownKeys = Object.keys(input).filter((k) => !shapeKeys.has(k));

    if (this._stripMode === "strict" && unknownKeys.length > 0) {
      issues.push({
        code: "unrecognized_keys",
        message: `Unrecognized key(s): ${unknownKeys.join(", ")}`,
        path,
      });
    } else if (this._stripMode === "passthrough") {
      for (const key of unknownKeys) {
        result[key] = input[key];
      }
    }
    // "strip" mode: just ignore unknown keys (default)

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    return result as InferShape<S>;
  }

  /**
   * Make all properties optional
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partial(): ObjectSchema<any> {
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of Object.keys(this._shape)) {
      newShape[key] = this._shape[key].optional();
    }
    return new ObjectSchema(newShape);
  }

  /**
   * Make all properties required (remove optional)
   */
  required(): ObjectSchema<S> {
    // Since we don't track optionality separately, return a clone
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of Object.keys(this._shape)) {
      newShape[key] = this._shape[key];
    }
    return new ObjectSchema(newShape) as unknown as ObjectSchema<S>;
  }

  /**
   * Pick specific keys
   */
  pick<K extends keyof S>(...keys: K[]): ObjectSchema<Pick<S, K>> {
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of keys) {
      newShape[key as string] = this._shape[key];
    }
    return new ObjectSchema(newShape) as ObjectSchema<Pick<S, K>>;
  }

  /**
   * Omit specific keys
   */
  omit<K extends keyof S>(...keys: K[]): ObjectSchema<Omit<S, K>> {
    const keysToOmit = new Set(keys.map(String));
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of Object.keys(this._shape)) {
      if (!keysToOmit.has(key)) {
        newShape[key] = this._shape[key];
      }
    }
    return new ObjectSchema(newShape) as ObjectSchema<Omit<S, K>>;
  }

  /**
   * Extend with additional shape
   */
  extend<E extends ObjectShape>(shape: E): ObjectSchema<S & E> {
    const newShape: Record<string, Schema<unknown>> = {};
    for (const key of Object.keys(this._shape)) {
      newShape[key] = this._shape[key];
    }
    for (const key of Object.keys(shape)) {
      newShape[key] = shape[key];
    }
    return new ObjectSchema(newShape) as ObjectSchema<S & E>;
  }

  /**
   * Merge with another object schema
   */
  merge<O extends ObjectShape>(other: ObjectSchema<O>): ObjectSchema<S & O> {
    return this.extend(other.shape);
  }

  /**
   * Allow extra keys to pass through
   */
  passthrough(): ObjectSchema<S> {
    const clone = this._cloneObject();
    clone._stripMode = "passthrough";
    return clone;
  }

  /**
   * Reject extra keys (throw validation error)
   */
  strict(): ObjectSchema<S> {
    const clone = this._cloneObject();
    clone._stripMode = "strict";
    return clone;
  }

  /**
   * Strip unknown keys (default behavior)
   */
  strip(): ObjectSchema<S> {
    const clone = this._cloneObject();
    clone._stripMode = "strip";
    return clone;
  }

  private _cloneObject(): ObjectSchema<S> {
    const clone = new ObjectSchema(this._shape);
    clone._stripMode = this._stripMode;
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    return clone;
  }

  protected override _clone(): this {
    return this._cloneObject() as this;
  }
}
