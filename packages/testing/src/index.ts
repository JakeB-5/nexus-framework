// @nexus/testing - Test utilities, mocking, and integration helpers

// Types
export type {
  TestAppOptions,
  ProviderOverride,
  MockOptions,
  FixtureOptions,
  FactoryDefinition,
  TestClientOptions,
  TestRequest,
  TestResponse,
  MatcherResult,
} from "./types.js";

// Errors
export { TestSetupError, AssertionError } from "./errors.js";

// Mocking
export { MockFn, mockFn, createMock, spy } from "./mocks.js";

// Test Application
export { TestApp, createTestApp } from "./test-app.js";

// Test Client
export { TestClient, RequestBuilder, createTestClient } from "./test-client.js";

// Fixtures & Factories
export {
  useFixture,
  loadFixture,
  teardownFixture,
  teardownAllFixtures,
  clearFixtures,
  defineFactory,
  Factory,
  sequence,
  numericSequence,
} from "./fixtures.js";

// Matchers
export {
  toBeValidResponse,
  toHaveHeader,
  toMatchSchema,
  toContainEntry,
  toBeWithinRange,
  toSatisfy,
} from "./matchers.js";

// Clock / Fake Timers
export { FakeClock, useFakeTimers } from "./clock.js";

// Database
export { TestDatabase, createTestDatabase } from "./database.js";

// Testing Module
export { TestingModule, TestingModuleBuilder } from "./testing-module.js";
