// @nexus/validator - Number schema

import { Schema, fail, typeOf } from "../schema.js";

export class NumberSchema extends Schema<number> {
  private _checks: Array<{
    kind: string;
    check: (value: number) => boolean;
    message: string;
  }> = [];

  _parse(data: unknown, path: Array<string | number>): number {
    if (typeof data !== "number" || Number.isNaN(data)) {
      fail("invalid_type", "Expected number, received " + typeOf(data), path, {
        expected: "number",
        received: typeOf(data),
      });
    }

    for (const check of this._checks) {
      if (!check.check(data)) {
        fail("invalid_number", check.message, path);
      }
    }

    return data;
  }

  min(value: number, message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "min",
      check: (v) => v >= value,
      message: message ?? `Number must be greater than or equal to ${value}`,
    });
    return clone;
  }

  max(value: number, message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "max",
      check: (v) => v <= value,
      message: message ?? `Number must be less than or equal to ${value}`,
    });
    return clone;
  }

  int(message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "int",
      check: (v) => Number.isInteger(v),
      message: message ?? "Expected integer, received float",
    });
    return clone;
  }

  positive(message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "positive",
      check: (v) => v > 0,
      message: message ?? "Number must be positive",
    });
    return clone;
  }

  negative(message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "negative",
      check: (v) => v < 0,
      message: message ?? "Number must be negative",
    });
    return clone;
  }

  finite(message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "finite",
      check: (v) => Number.isFinite(v),
      message: message ?? "Number must be finite",
    });
    return clone;
  }

  multipleOf(value: number, message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "multipleOf",
      check: (v) => v % value === 0,
      message: message ?? `Number must be a multiple of ${value}`,
    });
    return clone;
  }

  gt(value: number, message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "gt",
      check: (v) => v > value,
      message: message ?? `Number must be greater than ${value}`,
    });
    return clone;
  }

  gte(value: number, message?: string): NumberSchema {
    return this.min(value, message);
  }

  lt(value: number, message?: string): NumberSchema {
    const clone = this._clone() as NumberSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "lt",
      check: (v) => v < value,
      message: message ?? `Number must be less than ${value}`,
    });
    return clone;
  }

  lte(value: number, message?: string): NumberSchema {
    return this.max(value, message);
  }

  protected override _clone(): this {
    const clone = super._clone();
    (clone as unknown as NumberSchema)._checks = [...this._checks];
    return clone;
  }
}
