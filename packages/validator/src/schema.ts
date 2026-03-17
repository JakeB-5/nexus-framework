// @nexus/validator - Base Schema class

import { ValidationError } from "./errors.js";
import type { ValidationIssue, ValidationIssueCode } from "./errors.js";
import type { SafeParseResult } from "./types.js";

/**
 * Abstract base schema class.
 * All specific type schemas extend this.
 */
export abstract class Schema<T> {
  /** Run validation and return the parsed value or throw */
  abstract _parse(data: unknown, path: Array<string | number>): T;

  /** Refinement checks applied after primary validation */
  // Use `any` internally to keep Schema<T> covariant in T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _refinements: Array<{
    check: (value: any) => boolean;
    message: string | ((value: any) => string);
    code: ValidationIssueCode;
  }> = [];

  /** Transform functions applied after validation */
  protected _transforms: Array<(value: unknown) => unknown> = [];

  /** Default value if input is undefined */
  protected _defaultValue: T | (() => T) | undefined = undefined;
  protected _hasDefault = false;

  /** Whether the schema is optional */
  protected _isOptional = false;

  /** Whether the schema is nullable */
  protected _isNullable = false;

  /**
   * Parse data and return the result, throwing on failure
   */
  parse(data: unknown): T {
    // Handle default
    if (data === undefined && this._hasDefault) {
      const def = this._defaultValue;
      data = typeof def === "function" ? (def as () => T)() : def;
    }

    // Handle optional
    if (data === undefined && this._isOptional) {
      return undefined as T;
    }

    // Handle nullable
    if (data === null && this._isNullable) {
      return null as T;
    }

    const result = this._parse(data, []);

    // Apply refinements
    for (const refinement of this._refinements) {
      if (!refinement.check(result)) {
        const msg =
          typeof refinement.message === "function"
            ? refinement.message(result)
            : refinement.message;
        throw new ValidationError([
          { code: refinement.code, message: msg, path: [] },
        ]);
      }
    }

    // Apply transforms
    let transformed: unknown = result;
    for (const fn of this._transforms) {
      transformed = fn(transformed);
    }

    return transformed as T;
  }

  /**
   * Parse data without throwing - returns a result object
   */
  safeParse(data: unknown): SafeParseResult<T> {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error };
      }
      throw error;
    }
  }

  /**
   * Make this schema optional (accepts undefined)
   */
  optional(): Schema<T | undefined> {
    const clone = this._clone();
    clone._isOptional = true;
    return clone as unknown as Schema<T | undefined>;
  }

  /**
   * Make this schema nullable (accepts null)
   */
  nullable(): Schema<T | null> {
    const clone = this._clone();
    clone._isNullable = true;
    return clone as unknown as Schema<T | null>;
  }

  /**
   * Provide a default value when input is undefined
   */
  default(value: T | (() => T)): Schema<T> {
    const clone = this._clone();
    clone._defaultValue = value;
    clone._hasDefault = true;
    return clone;
  }

  /**
   * Transform the output value
   */
  transform<U>(fn: (value: T) => U): Schema<U> {
    const clone = this._clone();
    clone._transforms.push(fn as (value: unknown) => unknown);
    return clone as unknown as Schema<U>;
  }

  /**
   * Add a custom refinement check
   */
  refine(
    check: (value: T) => boolean,
    message: string | { message: string },
  ): Schema<T> {
    const clone = this._clone();
    const msg = typeof message === "string" ? message : message.message;
    clone._refinements.push({ check, message: msg, code: "custom" });
    return clone;
  }

  /**
   * Pipe into another schema for chained validation
   */
  pipe<U>(schema: Schema<U>): Schema<U> {
    const self = this;
    return new PipeSchema(self, schema);
  }

  /**
   * Clone this schema with all settings
   */
  protected _clone(): this {
    const clone = Object.create(Object.getPrototypeOf(this) as object) as this;
    Object.assign(clone, this);
    clone._refinements = [...this._refinements];
    clone._transforms = [...this._transforms];
    return clone;
  }
}

/**
 * Schema that pipes one schema's output into another
 */
class PipeSchema<I, O> extends Schema<O> {
  constructor(
    private readonly _input: Schema<I>,
    private readonly _output: Schema<O>,
  ) {
    super();
  }

  _parse(data: unknown, _path: Array<string | number>): O {
    // Use parse() on input to apply transforms before piping
    const intermediate = this._input.parse(data);
    return this._output.parse(intermediate as unknown);
  }
}

/**
 * Helper to create a validation issue and throw
 */
export function fail(
  code: ValidationIssueCode,
  message: string,
  path: Array<string | number>,
  extra?: { expected?: string; received?: string },
): never {
  const issue: ValidationIssue = { code, message, path, ...extra };
  throw new ValidationError([issue]);
}

/**
 * Helper to get a human-readable type name
 */
export function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  return typeof value;
}
