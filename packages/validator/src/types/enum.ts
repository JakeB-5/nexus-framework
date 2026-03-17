// @nexus/validator - Enum schema

import { Schema, fail, typeOf } from "../schema.js";

/**
 * Enum schema for a fixed set of string values
 */
export class EnumSchema<T extends string> extends Schema<T> {
  private readonly _valuesSet: Set<string>;

  constructor(private readonly _values: readonly T[]) {
    super();
    this._valuesSet = new Set(_values);
  }

  get options(): readonly T[] {
    return this._values;
  }

  _parse(data: unknown, path: Array<string | number>): T {
    if (typeof data !== "string") {
      fail("invalid_type", "Expected string, received " + typeOf(data), path, {
        expected: "string",
        received: typeOf(data),
      });
    }

    if (!this._valuesSet.has(data)) {
      fail(
        "invalid_enum",
        `Invalid enum value. Expected: ${this._values.map((v) => `'${v}'`).join(" | ")}, received: '${data}'`,
        path,
        {
          expected: this._values.join(" | "),
          received: data,
        },
      );
    }

    return data as T;
  }
}

/**
 * Native enum schema for TypeScript enums
 */
export class NativeEnumSchema<T extends Record<string, string | number>> extends Schema<T[keyof T]> {
  private readonly _validValues: Set<string | number>;

  constructor(enumObj: T) {
    super();
    // TypeScript enums have reverse mappings for numeric values
    // We need to extract only the actual values
    this._validValues = new Set<string | number>();
    for (const key of Object.keys(enumObj)) {
      const value = enumObj[key];
      // Skip reverse mappings (numeric enum keys)
      if (typeof value === "string" || typeof value === "number") {
        if (typeof key !== "number" && !(/^\d+$/.test(key))) {
          this._validValues.add(value);
        }
      }
    }
  }

  _parse(data: unknown, path: Array<string | number>): T[keyof T] {
    if (typeof data !== "string" && typeof data !== "number") {
      fail("invalid_type", "Expected string or number, received " + typeOf(data), path, {
        expected: "string | number",
        received: typeOf(data),
      });
    }

    if (!this._validValues.has(data)) {
      const vals = [...this._validValues].map((v) => typeof v === "string" ? `'${v}'` : v);
      fail(
        "invalid_enum",
        `Invalid enum value. Expected: ${vals.join(" | ")}, received: ${typeof data === "string" ? `'${data}'` : data}`,
        path,
      );
    }

    return data as T[keyof T];
  }
}
