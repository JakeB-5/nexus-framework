// @nexus/testing - Test application factory

import { TestSetupError } from "./errors.js";
import type { ProviderOverride, TestAppOptions } from "./types.js";

/**
 * Test application for integration testing
 */
export class TestApp {
  private providers = new Map<unknown, unknown>();
  private overrides = new Map<unknown, ProviderOverride>();
  private initialized = false;
  private destroyed = false;
  private cleanupFns: Array<() => void | Promise<void>> = [];

  constructor(options?: TestAppOptions) {
    if (options?.providers) {
      for (const provider of options.providers) {
        this.registerProvider(provider);
      }
    }
  }

  /**
   * Register a provider
   */
  private registerProvider(provider: ProviderOverride): void {
    if (provider.useValue !== undefined) {
      this.providers.set(provider.provide, provider.useValue);
    } else if (provider.useFactory) {
      this.providers.set(provider.provide, provider.useFactory());
    } else if (provider.useClass) {
      this.providers.set(provider.provide, new provider.useClass());
    }
  }

  /**
   * Override a provider for testing
   */
  overrideProvider(token: unknown): { useValue: (value: unknown) => TestApp; useClass: (cls: new (...args: unknown[]) => unknown) => TestApp; useFactory: (fn: () => unknown) => TestApp } {
    const self = this;
    return {
      useValue(value: unknown): TestApp {
        self.overrides.set(token, { provide: token, useValue: value });
        self.providers.set(token, value);
        return self;
      },
      useClass(cls: new (...args: unknown[]) => unknown): TestApp {
        const instance = new cls();
        self.overrides.set(token, { provide: token, useClass: cls });
        self.providers.set(token, instance);
        return self;
      },
      useFactory(fn: () => unknown): TestApp {
        const value = fn();
        self.overrides.set(token, { provide: token, useFactory: fn });
        self.providers.set(token, value);
        return self;
      },
    };
  }

  /**
   * Get a provider value by token
   */
  get<T>(token: unknown): T {
    if (!this.providers.has(token)) {
      throw new TestSetupError(`Provider not found: ${String(token)}`);
    }
    return this.providers.get(token) as T;
  }

  /**
   * Check if a provider is registered
   */
  has(token: unknown): boolean {
    return this.providers.has(token);
  }

  /**
   * Initialize the test app
   */
  async init(): Promise<this> {
    if (this.initialized) return this;
    this.initialized = true;

    // Call onInit on providers that have it
    for (const [, value] of this.providers) {
      if (value !== null && typeof value === "object" && "onInit" in (value as Record<string, unknown>)) {
        await (value as { onInit: () => Promise<void> | void }).onInit();
      }
    }

    return this;
  }

  /**
   * Cleanup the test app
   */
  async close(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    // Run cleanup functions
    for (const fn of this.cleanupFns) {
      await fn();
    }

    // Call onDestroy on providers
    for (const [, value] of this.providers) {
      if (value !== null && typeof value === "object" && "onDestroy" in (value as Record<string, unknown>)) {
        await (value as { onDestroy: () => Promise<void> | void }).onDestroy();
      }
    }

    this.providers.clear();
    this.overrides.clear();
  }

  /**
   * Register a cleanup function
   */
  onCleanup(fn: () => void | Promise<void>): void {
    this.cleanupFns.push(fn);
  }

  /**
   * Get whether the app is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get whether the app is destroyed
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }
}

/**
 * Create a test application
 */
export function createTestApp(options?: TestAppOptions): TestApp {
  return new TestApp(options);
}
