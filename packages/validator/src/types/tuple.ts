// @nexus/validator - Tuple schema

import { Schema, fail, typeOf } from "../schema.js";
import { ValidationError } from "../errors.js";
import type { ValidationIssue } from "../errors.js";

type InferTuple<T extends Schema<unknown>[]> = {
  [K in keyof T]: T[K] extends Schema<infer U> ? U : never;
};

export class TupleSchema<T extends Schema<unknown>[]> extends Schema<InferTuple<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _restSchema: Schema<any> | undefined = undefined;

  constructor(private readonly _items: T) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): InferTuple<T> {
    if (!Array.isArray(data)) {
      fail("invalid_type", "Expected array (tuple), received " + typeOf(data), path, {
        expected: "array",
        received: typeOf(data),
      });
    }

    if (!this._restSchema && data.length !== this._items.length) {
      fail(
        "invalid_type",
        `Expected tuple of ${this._items.length} elements, received ${data.length}`,
        path,
      );
    }

    if (!this._restSchema && data.length !== this._items.length) {
      // Already handled above, but just in case
    }

    if (this._restSchema && data.length < this._items.length) {
      fail(
        "too_small",
        `Tuple must have at least ${this._items.length} element(s)`,
        path,
      );
    }

    const issues: ValidationIssue[] = [];
    const result: unknown[] = [];

    // Parse fixed items
    for (let i = 0; i < this._items.length; i++) {
      try {
        result.push(this._items[i]._parse(data[i], [...path, i]));
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(...error.issues);
        } else {
          throw error;
        }
      }
    }

    // Parse rest items
    if (this._restSchema) {
      for (let i = this._items.length; i < data.length; i++) {
        try {
          result.push(this._restSchema._parse(data[i], [...path, i]));
        } catch (error) {
          if (error instanceof ValidationError) {
            issues.push(...error.issues);
          } else {
            throw error;
          }
        }
      }
    }

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    return result as InferTuple<T>;
  }

  /**
   * Add a rest schema for variadic tuple elements
   */
  rest<R>(schema: Schema<R>): TupleSchema<T> {
    const clone = Object.create(Object.getPrototypeOf(this) as object) as TupleSchema<T>;
    Object.assign(clone, this);
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    clone._restSchema = schema;
    return clone;
  }
}
