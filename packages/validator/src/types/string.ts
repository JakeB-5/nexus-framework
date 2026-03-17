// @nexus/validator - String schema

import { Schema, fail, typeOf } from "../schema.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
const CUID_RE = /^c[a-z0-9]{24}$/;
const IP_V4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IP_V6_RE = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

export class StringSchema extends Schema<string> {
  private _checks: Array<{
    kind: string;
    check: (value: string) => boolean;
    message: string;
  }> = [];
  private _stringTransforms: Array<(value: string) => string> = [];

  _parse(data: unknown, path: Array<string | number>): string {
    if (typeof data !== "string") {
      fail("invalid_type", "Expected string, received " + typeOf(data), path, {
        expected: "string",
        received: typeOf(data),
      });
    }

    // Apply string-specific transforms first
    let value = data;
    for (const fn of this._stringTransforms) {
      value = fn(value);
    }

    // Run checks
    for (const check of this._checks) {
      if (!check.check(value)) {
        fail("invalid_string", check.message, path);
      }
    }

    return value;
  }

  min(length: number, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "min",
      check: (v) => v.length >= length,
      message: message ?? `String must be at least ${length} character(s)`,
    });
    return clone;
  }

  max(length: number, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "max",
      check: (v) => v.length <= length,
      message: message ?? `String must be at most ${length} character(s)`,
    });
    return clone;
  }

  length(length: number, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "length",
      check: (v) => v.length === length,
      message: message ?? `String must be exactly ${length} character(s)`,
    });
    return clone;
  }

  email(message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "email",
      check: (v) => EMAIL_RE.test(v),
      message: message ?? "Invalid email address",
    });
    return clone;
  }

  url(message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "url",
      check: (v) => URL_RE.test(v),
      message: message ?? "Invalid URL",
    });
    return clone;
  }

  uuid(message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "uuid",
      check: (v) => UUID_RE.test(v),
      message: message ?? "Invalid UUID",
    });
    return clone;
  }

  regex(pattern: RegExp, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "regex",
      check: (v) => pattern.test(v),
      message: message ?? `String must match pattern ${pattern.source}`,
    });
    return clone;
  }

  startsWith(prefix: string, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "startsWith",
      check: (v) => v.startsWith(prefix),
      message: message ?? `String must start with "${prefix}"`,
    });
    return clone;
  }

  endsWith(suffix: string, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "endsWith",
      check: (v) => v.endsWith(suffix),
      message: message ?? `String must end with "${suffix}"`,
    });
    return clone;
  }

  includes(substr: string, message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "includes",
      check: (v) => v.includes(substr),
      message: message ?? `String must include "${substr}"`,
    });
    return clone;
  }

  nonempty(message?: string): StringSchema {
    return this.min(1, message ?? "String must not be empty");
  }

  ip(message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "ip",
      check: (v) => IP_V4_RE.test(v) || IP_V6_RE.test(v),
      message: message ?? "Invalid IP address",
    });
    return clone;
  }

  datetime(message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "datetime",
      check: (v) => DATETIME_RE.test(v),
      message: message ?? "Invalid datetime string",
    });
    return clone;
  }

  cuid(message?: string): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._checks.push({
      kind: "cuid",
      check: (v) => CUID_RE.test(v),
      message: message ?? "Invalid CUID",
    });
    return clone;
  }

  trim(): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._stringTransforms.push((v) => v.trim());
    return clone;
  }

  toLowerCase(): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._stringTransforms.push((v) => v.toLowerCase());
    return clone;
  }

  toUpperCase(): StringSchema {
    const clone = this._clone() as StringSchema;
    clone._checks = [...this._checks];
    clone._stringTransforms = [...this._stringTransforms];
    clone._stringTransforms.push((v) => v.toUpperCase());
    return clone;
  }

  protected override _clone(): this {
    const clone = super._clone();
    (clone as unknown as StringSchema)._checks = [...this._checks];
    (clone as unknown as StringSchema)._stringTransforms = [...this._stringTransforms];
    return clone;
  }
}
