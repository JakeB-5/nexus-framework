// @nexus/validator - Literal schema

import { Schema, fail } from "../schema.js";

type Primitive = string | number | boolean | null | undefined;

export class LiteralSchema<T extends Primitive> extends Schema<T> {
  constructor(private readonly _value: T) {
    super();
  }

  get value(): T {
    return this._value;
  }

  _parse(data: unknown, path: Array<string | number>): T {
    if (data !== this._value) {
      const expected = this._value === null ? "null" : this._value === undefined ? "undefined" : JSON.stringify(this._value);
      const received = data === null ? "null" : data === undefined ? "undefined" : JSON.stringify(data);
      fail("invalid_literal", `Expected ${expected}, received ${received}`, path, {
        expected,
        received,
      });
    }
    return data as T;
  }
}
