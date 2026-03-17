// @nexus/testing - Test fixture management

import { TestSetupError } from "./errors.js";
import type { FixtureOptions } from "./types.js";

// ─── Fixture Registry ─────────────────────────────────────────────────────

const fixtures = new Map<string, FixtureOptions>();
const fixtureData = new Map<string, unknown>();

/**
 * Register a test fixture
 */
export function useFixture<T>(
  name: string,
  setup: () => T | Promise<T>,
  teardown?: (data: T) => void | Promise<void>,
): void {
  fixtures.set(name, { name, setup, teardown: teardown as ((data: unknown) => void | Promise<void>) | undefined });
}

/**
 * Load a fixture by name
 */
export async function loadFixture<T>(name: string): Promise<T> {
  const fixture = fixtures.get(name);
  if (!fixture) {
    throw new TestSetupError(`Fixture not found: ${name}`);
  }

  if (fixtureData.has(name)) {
    return fixtureData.get(name) as T;
  }

  const data = await fixture.setup();
  fixtureData.set(name, data);
  return data as T;
}

/**
 * Teardown a fixture
 */
export async function teardownFixture(name: string): Promise<void> {
  const fixture = fixtures.get(name);
  const data = fixtureData.get(name);
  if (fixture?.teardown && data !== undefined) {
    await fixture.teardown(data);
  }
  fixtureData.delete(name);
}

/**
 * Teardown all loaded fixtures
 */
export async function teardownAllFixtures(): Promise<void> {
  for (const name of fixtureData.keys()) {
    await teardownFixture(name);
  }
}

/**
 * Clear fixture registry
 */
export function clearFixtures(): void {
  fixtures.clear();
  fixtureData.clear();
}

// ─── Factory Pattern ──────────────────────────────────────────────────────

/**
 * Define a factory for creating test objects
 */
export function defineFactory<T extends Record<string, unknown>>(
  name: string,
  defaults: T | (() => T),
): Factory<T> {
  return new Factory<T>(name, defaults);
}

/**
 * Factory for creating test data with sensible defaults
 */
export class Factory<T extends Record<string, unknown>> {
  private name: string;
  private defaults: T | (() => T);
  private _sequence = 0;
  private _traits = new Map<string, Partial<T>>();

  constructor(name: string, defaults: T | (() => T)) {
    this.name = name;
    this.defaults = defaults;
  }

  /**
   * Define a named trait (preset overrides)
   */
  trait(name: string, overrides: Partial<T>): this {
    this._traits.set(name, overrides);
    return this;
  }

  /**
   * Create a single instance
   */
  create(overrides?: Partial<T>): T {
    this._sequence++;
    const base = typeof this.defaults === "function" ? this.defaults() : { ...this.defaults };
    return { ...base, ...overrides } as T;
  }

  /**
   * Create an instance with a named trait applied
   */
  createWithTrait(traitName: string, overrides?: Partial<T>): T {
    const trait = this._traits.get(traitName);
    if (!trait) {
      throw new TestSetupError(`Trait "${traitName}" not found on factory "${this.name}"`);
    }
    return this.create({ ...trait, ...overrides });
  }

  /**
   * Create multiple instances
   */
  createMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Get the current sequence number
   */
  get sequence(): number {
    return this._sequence;
  }

  /**
   * Reset the sequence counter
   */
  resetSequence(): void {
    this._sequence = 0;
  }
}

// ─── Sequence Generator ───────────────────────────────────────────────────

/**
 * Create a sequence generator for unique values
 */
export function sequence(prefix = ""): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `${prefix}${counter}`;
  };
}

/**
 * Create a numeric sequence
 */
export function numericSequence(start = 1): () => number {
  let counter = start - 1;
  return () => {
    counter++;
    return counter;
  };
}
