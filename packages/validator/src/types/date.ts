// @nexus/validator - Date schema

import { Schema, fail, typeOf } from "../schema.js";

export class DateSchema extends Schema<Date> {
  private _checks: Array<{
    kind: string;
    check: (value: Date) => boolean;
    message: string;
  }> = [];

  _parse(data: unknown, path: Array<string | number>): Date {
    if (!(data instanceof Date)) {
      fail("invalid_type", "Expected Date, received " + typeOf(data), path, {
        expected: "date",
        received: typeOf(data),
      });
    }

    if (Number.isNaN(data.getTime())) {
      fail("invalid_date", "Invalid date", path);
    }

    for (const check of this._checks) {
      if (!check.check(data)) {
        fail("invalid_date", check.message, path);
      }
    }

    return data;
  }

  min(minDate: Date, message?: string): DateSchema {
    const clone = this._clone() as DateSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "min",
      check: (v) => v.getTime() >= minDate.getTime(),
      message: message ?? `Date must be after ${minDate.toISOString()}`,
    });
    return clone;
  }

  max(maxDate: Date, message?: string): DateSchema {
    const clone = this._clone() as DateSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "max",
      check: (v) => v.getTime() <= maxDate.getTime(),
      message: message ?? `Date must be before ${maxDate.toISOString()}`,
    });
    return clone;
  }

  past(message?: string): DateSchema {
    const clone = this._clone() as DateSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "past",
      check: (v) => v.getTime() < Date.now(),
      message: message ?? "Date must be in the past",
    });
    return clone;
  }

  future(message?: string): DateSchema {
    const clone = this._clone() as DateSchema;
    clone._checks = [...this._checks];
    clone._checks.push({
      kind: "future",
      check: (v) => v.getTime() > Date.now(),
      message: message ?? "Date must be in the future",
    });
    return clone;
  }

  protected override _clone(): this {
    const clone = super._clone();
    (clone as unknown as DateSchema)._checks = [...this._checks];
    return clone;
  }
}
