// @nexus/validator - Array schema

import { Schema, fail, typeOf } from "../schema.js";
import { ValidationError } from "../errors.js";
import type { ValidationIssue } from "../errors.js";

export class ArraySchema<T> extends Schema<T[]> {
  private _checks: Array<{
    kind: string;
    check: (value: T[]) => boolean;
    message: string;
  }> = [];

  constructor(private readonly _itemSchema: Schema<T>) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): T[] {
    if (!Array.isArray(data)) {
      fail("invalid_type", "Expected array, received " + typeOf(data), path, {
        expected: "array",
        received: typeOf(data),
      });
    }

    const issues: ValidationIssue[] = [];
    const result: T[] = [];

    for (let i = 0; i < data.length; i++) {
      try {
        result.push(this._itemSchema._parse(data[i], [...path, i]));
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

    // Run checks on the validated array
    for (const check of this._checks) {
      if (!check.check(result)) {
        fail("too_small", check.message, path);
      }
    }

    return result;
  }

  min(length: number, message?: string): ArraySchema<T> {
    const clone = this._clone() as ArraySchema<T>;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "min",
      check: (v) => v.length >= length,
      message: message ?? `Array must contain at least ${length} element(s)`,
    });
    return clone;
  }

  max(length: number, message?: string): ArraySchema<T> {
    const clone = this._clone() as ArraySchema<T>;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "max",
      check: (v) => v.length <= length,
      message: message ?? `Array must contain at most ${length} element(s)`,
    });
    return clone;
  }

  length(length: number, message?: string): ArraySchema<T> {
    const clone = this._clone() as ArraySchema<T>;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "length",
      check: (v) => v.length === length,
      message: message ?? `Array must contain exactly ${length} element(s)`,
    });
    return clone;
  }

  nonempty(message?: string): ArraySchema<T> {
    return this.min(1, message ?? "Array must not be empty");
  }

  unique(comparator?: (a: T, b: T) => boolean, message?: string): ArraySchema<T> {
    const clone = this._clone() as ArraySchema<T>;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "unique",
      check: (v) => {
        if (comparator) {
          for (let i = 0; i < v.length; i++) {
            for (let j = i + 1; j < v.length; j++) {
              if (comparator(v[i], v[j])) return false;
            }
          }
          return true;
        }
        return new Set(v).size === v.length;
      },
      message: message ?? "Array must contain unique elements",
    });
    return clone;
  }

  protected override _clone(): this {
    const clone = Object.create(Object.getPrototypeOf(this) as object) as this;
    Object.assign(clone, this);
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    (clone as unknown as ArraySchema<T>)._checks = [...this._checks];
    return clone;
  }
}
