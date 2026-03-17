// @nexus/testing - Error types

export class TestSetupError extends Error {
  public readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "TestSetupError";
    this.code = code ?? "TEST_SETUP_ERROR";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AssertionError extends Error {
  public readonly expected: unknown;
  public readonly actual: unknown;

  constructor(message: string, expected?: unknown, actual?: unknown) {
    super(message);
    this.name = "AssertionError";
    this.expected = expected;
    this.actual = actual;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
