// @nexus/testing - TestingModule builder

import { TestSetupError } from "./errors.js";
import type { ProviderOverride } from "./types.js";

/**
 * Builder for configuring a test module with provider overrides
 */
export class TestingModule {
  private _providers = new Map<unknown, unknown>();
  private _overrides = new Map<unknown, ProviderOverride>();
  private _initialized = false;
  private _destroyed = false;
  private _cleanupFns: Array<() => void | Promise<void>> = [];

  private constructor() {}

  /**
   * Create a new TestingModule builder
   */
  static create(): TestingModuleBuilder {
    return new TestingModuleBuilder();
  }

  /**
   * Internal: build instance from builder
   */
  static _build(
    providers: ProviderOverride[],
    overrides: Map<unknown, ProviderOverride>,
  ): TestingModule {
    const instance = new TestingModule();
    for (const provider of providers) {
      instance._registerProvider(provider);
    }
    for (const [, override] of overrides) {
      instance._overrides.set(override.provide, override);
      instance._registerProvider(override);
    }
    return instance;
  }

  private _registerProvider(provider: ProviderOverride): void {
    if (provider.useValue !== undefined) {
      this._providers.set(provider.provide, provider.useValue);
    } else if (provider.useFactory) {
      this._providers.set(provider.provide, provider.useFactory());
    } else if (provider.useClass) {
      this._providers.set(provider.provide, new provider.useClass());
    }
  }

  /**
   * Get a provider value by token
   */
  get<T>(token: unknown): T {
    if (!this._providers.has(token)) {
      throw new TestSetupError(`Provider not found: ${String(token)}`);
    }
    return this._providers.get(token) as T;
  }

  /**
   * Check if a provider is registered
   */
  has(token: unknown): boolean {
    return this._providers.has(token);
  }

  /**
   * Initialize all providers
   */
  async init(): Promise<this> {
    if (this._initialized) return this;
    this._initialized = true;

    for (const [, value] of this._providers) {
      if (value !== null && typeof value === "object" && "onInit" in (value as Record<string, unknown>)) {
        await (value as { onInit: () => Promise<void> | void }).onInit();
      }
    }

    return this;
  }

  /**
   * Close and cleanup
   */
  async close(): Promise<void> {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const fn of this._cleanupFns) {
      await fn();
    }

    for (const [, value] of this._providers) {
      if (value !== null && typeof value === "object" && "onDestroy" in (value as Record<string, unknown>)) {
        await (value as { onDestroy: () => Promise<void> | void }).onDestroy();
      }
    }

    this._providers.clear();
    this._overrides.clear();
  }

  /**
   * Register a cleanup function
   */
  onCleanup(fn: () => void | Promise<void>): void {
    this._cleanupFns.push(fn);
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  get isDestroyed(): boolean {
    return this._destroyed;
  }
}

/**
 * Builder pattern for creating TestingModule instances
 */
export class TestingModuleBuilder {
  private _providers: ProviderOverride[] = [];
  private _overrides = new Map<unknown, ProviderOverride>();
  private _imports: Array<{ providers?: ProviderOverride[] }> = [];

  /**
   * Add providers
   */
  providers(providers: ProviderOverride[]): this {
    this._providers.push(...providers);
    return this;
  }

  /**
   * Add a single provider
   */
  provide(token: unknown, value: unknown): this {
    this._providers.push({ provide: token, useValue: value });
    return this;
  }

  /**
   * Import a module (extracts its providers)
   */
  import(module: { providers?: ProviderOverride[] }): this {
    this._imports.push(module);
    return this;
  }

  /**
   * Override a provider
   */
  overrideProvider(token: unknown): { useValue: (value: unknown) => TestingModuleBuilder; useClass: (cls: new (...args: unknown[]) => unknown) => TestingModuleBuilder; useFactory: (fn: () => unknown) => TestingModuleBuilder } {
    const self = this;
    return {
      useValue(value: unknown): TestingModuleBuilder {
        self._overrides.set(token, { provide: token, useValue: value });
        return self;
      },
      useClass(cls: new (...args: unknown[]) => unknown): TestingModuleBuilder {
        self._overrides.set(token, { provide: token, useClass: cls });
        return self;
      },
      useFactory(fn: () => unknown): TestingModuleBuilder {
        self._overrides.set(token, { provide: token, useFactory: fn });
        return self;
      },
    };
  }

  /**
   * Build and compile the testing module
   */
  async compile(): Promise<TestingModule> {
    const allProviders: ProviderOverride[] = [];
    for (const imp of this._imports) {
      if (imp.providers) {
        allProviders.push(...imp.providers);
      }
    }
    allProviders.push(...this._providers);

    const instance = TestingModule._build(allProviders, this._overrides);
    await instance.init();
    return instance;
  }
}
