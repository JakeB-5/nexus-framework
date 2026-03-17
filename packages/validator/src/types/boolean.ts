// @nexus/validator - Boolean schema

import { Schema, fail, typeOf } from "../schema.js";

export class BooleanSchema extends Schema<boolean> {
  _parse(data: unknown, path: Array<string | number>): boolean {
    if (typeof data !== "boolean") {
      fail("invalid_type", "Expected boolean, received " + typeOf(data), path, {
        expected: "boolean",
        received: typeOf(data),
      });
    }
    return data;
  }
}
