// @nexus/testing - Mocking utilities

/**
 * A mock function that tracks calls and can be configured
 */
export class MockFn<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  private _calls: TArgs[] = [];
  private _returnValue: TReturn | undefined;
  private _returnValues: TReturn[] = [];
  private _implementation: ((...args: TArgs) => TReturn) | undefined;
  private _throwError: Error | undefined;

  /**
   * Call the mock function
   */
  call = (...args: TArgs): TReturn => {
    this._calls.push(args);

    if (this._throwError) {
      throw this._throwError;
    }

    if (this._implementation) {
      return this._implementation(...args);
    }

    if (this._returnValues.length > 0) {
      return this._returnValues.shift()!;
    }

    return this._returnValue as TReturn;
  };

  /**
   * Get all recorded calls
   */
  get calls(): readonly TArgs[] {
    return this._calls;
  }

  /**
   * Get the number of times this mock was called
   */
  get callCount(): number {
    return this._calls.length;
  }

  /**
   * Check if the mock was called
   */
  get called(): boolean {
    return this._calls.length > 0;
  }

  /**
   * Get the last call arguments
   */
  get lastCall(): TArgs | undefined {
    return this._calls[this._calls.length - 1];
  }

  /**
   * Set a return value
   */
  returns(value: TReturn): this {
    this._returnValue = value;
    return this;
  }

  /**
   * Set sequential return values
   */
  returnsOnce(value: TReturn): this {
    this._returnValues.push(value);
    return this;
  }

  /**
   * Make the mock throw an error when called
   */
  throws(error: Error | string): this {
    this._throwError = typeof error === "string" ? new Error(error) : error;
    return this;
  }

  /**
   * Set a custom implementation
   */
  implements(fn: (...args: TArgs) => TReturn): this {
    this._implementation = fn;
    return this;
  }

  /**
   * Check if mock was called with specific arguments
   */
  calledWith(...args: TArgs): boolean {
    return this._calls.some((call) =>
      call.length === args.length && call.every((arg, i) => deepEqual(arg, args[i])),
    );
  }

  /**
   * Get the Nth call arguments
   */
  nthCall(n: number): TArgs | undefined {
    return this._calls[n];
  }

  /**
   * Reset all tracking and configuration
   */
  reset(): void {
    this._calls = [];
    this._returnValue = undefined;
    this._returnValues = [];
    this._implementation = undefined;
    this._throwError = undefined;
  }

  /**
   * Reset only call tracking (keep configuration)
   */
  resetCalls(): void {
    this._calls = [];
  }
}

/**
 * Create a mock function
 */
export function mockFn<TArgs extends unknown[] = unknown[], TReturn = unknown>(): MockFn<TArgs, TReturn> {
  return new MockFn<TArgs, TReturn>();
}

/**
 * Create a typed mock object with all methods as MockFn
 */
export function createMock<T extends object>(methods?: string[]): T & { __mocks: Map<string, MockFn> } {
  const mocks = new Map<string, MockFn>();

  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === "__mocks") return mocks;

      if (!mocks.has(prop)) {
        const fn = new MockFn();
        mocks.set(prop, fn);
      }
      return mocks.get(prop)!.call;
    },
  };

  if (methods) {
    const target: Record<string, unknown> = {};
    for (const method of methods) {
      const fn = new MockFn();
      mocks.set(method, fn);
      target[method] = fn.call;
    }
    return new Proxy(target, handler) as T & { __mocks: Map<string, MockFn> };
  }

  return new Proxy({}, handler) as T & { __mocks: Map<string, MockFn> };
}

/**
 * Spy on a method of an object
 */
export function spy<T extends object>(
  object: T,
  method: keyof T & string,
): MockFn {
  const original = object[method] as unknown as (...args: unknown[]) => unknown;
  const fn = new MockFn();
  fn.implements((...args: unknown[]) => original.apply(object, args));

  (object as Record<string, unknown>)[method] = fn.call;

  return fn;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}
