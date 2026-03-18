// @nexus/testing - Error types

import { NexusError } from "@nexus/core";

export class TestSetupError extends NexusError {
  constructor(message: string, code?: string) {
    super(message, { code: code ?? "TEST_SETUP_ERROR" });
    this.name = "TestSetupError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AssertionError extends NexusError {
  public readonly expected: unknown;
  public readonly actual: unknown;

  constructor(message: string, expected?: unknown, actual?: unknown) {
    super(message, { code: "ASSERTION_ERROR" });
    this.name = "AssertionError";
    this.expected = expected;
    this.actual = actual;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
