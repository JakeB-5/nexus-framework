// @nexus/validator - Special type schemas

import { Schema, fail, typeOf } from "../schema.js";
import type { ValidationIssue } from "../errors.js";
import { ValidationError } from "../errors.js";

/**
 * Accepts any value without validation
 */
export class AnySchema extends Schema<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _parse(data: unknown, _path: Array<string | number>): unknown {
    return data;
  }
}

/**
 * Accepts any value (same as any but semantically different)
 */
export class UnknownSchema extends Schema<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _parse(data: unknown, _path: Array<string | number>): unknown {
    return data;
  }
}

/**
 * Never accepts any value
 */
export class NeverSchema extends Schema<never> {
  _parse(data: unknown, path: Array<string | number>): never {
    fail("invalid_type", "Expected never, no value is valid", path, {
      expected: "never",
      received: typeOf(data),
    });
  }
}

/**
 * Accepts undefined or void
 */
export class VoidSchema extends Schema<void> {
  _parse(data: unknown, path: Array<string | number>): void {
    if (data !== undefined && data !== null) {
      fail("invalid_type", "Expected void (undefined), received " + typeOf(data), path, {
        expected: "void",
        received: typeOf(data),
      });
    }
    return undefined;
  }
}

/**
 * Validates that value is an instance of a class
 */
export class InstanceOfSchema<T> extends Schema<T> {
  constructor(private readonly _cls: new (...args: unknown[]) => T) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): T {
    if (!(data instanceof this._cls)) {
      fail(
        "invalid_type",
        `Expected instance of ${this._cls.name}, received ${typeOf(data)}`,
        path,
        { expected: this._cls.name, received: typeOf(data) },
      );
    }
    return data;
  }
}

/**
 * Lazy schema for recursive types
 */
export class LazySchema<T> extends Schema<T> {
  private _resolved: Schema<T> | undefined = undefined;

  constructor(private readonly _getter: () => Schema<T>) {
    super();
  }

  private _resolve(): Schema<T> {
    if (!this._resolved) {
      this._resolved = this._getter();
    }
    return this._resolved;
  }

  _parse(data: unknown, path: Array<string | number>): T {
    return this._resolve()._parse(data, path);
  }
}

/**
 * Promise schema - validates that value is a Promise resolving to schema type
 */
export class PromiseSchema<T> extends Schema<Promise<T>> {
  constructor(private readonly _innerSchema: Schema<T>) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): Promise<T> {
    if (!(data instanceof Promise)) {
      fail("invalid_type", "Expected Promise, received " + typeOf(data), path, {
        expected: "Promise",
        received: typeOf(data),
      });
    }

    // Return a wrapped promise that validates the resolved value
    return data.then((resolved) => this._innerSchema._parse(resolved, path));
  }
}

/**
 * Custom schema with user-provided validation function
 */
export class CustomSchema<T> extends Schema<T> {
  constructor(
    private readonly _validator: (data: unknown) => T | { success: true; data: T } | { success: false; message: string },
  ) {
    super();
  }

  _parse(data: unknown, path: Array<string | number>): T {
    try {
      const result = this._validator(data);

      // Check if result is a success/failure object
      if (result !== null && typeof result === "object" && "success" in result) {
        const resultObj = result as { success: boolean; data?: T; message?: string };
        if (resultObj.success) {
          return resultObj.data as T;
        }
        const issues: ValidationIssue[] = [{
          code: "custom",
          message: resultObj.message ?? "Custom validation failed",
          path,
        }];
        throw new ValidationError(issues);
      }

      return result as T;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : "Custom validation failed";
      fail("custom", msg, path);
    }
  }
}
