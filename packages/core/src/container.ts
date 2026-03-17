// @nexus/core - Full DI container implementation

import {
  getInjectableMetadata,
  getInjectTokens,
  getOptionalParams,
} from "./decorators.js";
import {
  CircularDependencyError,
  DependencyResolutionError,
} from "./errors.js";
import {
  type Constructor,
  type Provider,
  type Token,
  Scope,
  isClassProvider,
  isExistingProvider,
  isFactoryProvider,
  isValueProvider,
  isDisposable,
} from "./types.js";
import { getTokenName } from "./utils.js";

// ─── Internal Types ───────────────────────────────────────────────────────

interface Registration<T = unknown> {
  provider: Provider<T> | { provide: Token<T>; useClass: Constructor<T> };
  scope: Scope;
}

// ─── Container ────────────────────────────────────────────────────────────

/**
 * Dependency Injection Container
 *
 * Supports singleton, transient, and scoped lifetimes.
 * Provides circular dependency detection, async resolution,
 * factory registrations, child containers, and auto-disposal.
 */
export class Container {
  private registrations = new Map<Token, Registration>();
  private singletons = new Map<Token, unknown>();
  private scopedInstances = new Map<Token, unknown>();
  private resolving = new Set<Token>();
  private parent: Container | null;
  private children = new Set<Container>();
  private disposed = false;
  private readonly isScope: boolean;

  constructor(options?: { parent?: Container; isScope?: boolean }) {
    this.parent = options?.parent ?? null;
    this.isScope = options?.isScope ?? false;
  }

  /**
   * Register a provider in the container.
   *
   * Accepts:
   * - A constructor (auto-registered as ClassProvider)
   * - A Provider object (ClassProvider, ValueProvider, FactoryProvider, ExistingProvider)
   */
  register<T>(providerOrClass: Provider<T> | Constructor<T>): this {
    this.ensureNotDisposed();

    if (typeof providerOrClass === "function") {
      // Auto-register constructor as ClassProvider
      const ctor = providerOrClass as Constructor<T>;
      const meta = getInjectableMetadata(ctor);
      const scope = meta?.scope ?? Scope.Singleton;
      const registration: Registration<T> = {
        provider: {
          provide: ctor as Token<T>,
          useClass: ctor,
        },
        scope,
      };
      this.registrations.set(ctor, registration);
      return this;
    }

    const provider = providerOrClass;
    let scope = Scope.Singleton;

    if (isClassProvider(provider)) {
      const meta = getInjectableMetadata(provider.useClass);
      scope = provider.scope ?? meta?.scope ?? Scope.Singleton;
    } else if (isFactoryProvider(provider)) {
      scope = provider.scope ?? Scope.Singleton;
    } else if (isValueProvider(provider)) {
      // Value providers are always singleton-like
      scope = Scope.Singleton;
    }

    this.registrations.set(provider.provide, {
      provider,
      scope,
    } as Registration);
    return this;
  }

  /**
   * Register a value directly under a token.
   */
  registerValue<T>(token: Token<T>, value: T): this {
    this.ensureNotDisposed();
    this.registrations.set(token, {
      provider: { provide: token, useValue: value },
      scope: Scope.Singleton,
    } as Registration);
    // Store it as a resolved singleton immediately
    this.singletons.set(token, value);
    return this;
  }

  /**
   * Register a factory function under a token.
   */
  registerFactory<T>(
    token: Token<T>,
    factory: (...args: unknown[]) => T | Promise<T>,
    options?: { inject?: Token[]; scope?: Scope },
  ): this {
    this.ensureNotDisposed();
    this.registrations.set(token, {
      provider: {
        provide: token,
        useFactory: factory,
        inject: options?.inject,
      },
      scope: options?.scope ?? Scope.Singleton,
    } as Registration);
    return this;
  }

  /**
   * Resolve a dependency by its token.
   * Throws DependencyResolutionError if not found.
   */
  resolve<T>(token: Token<T>): T {
    this.ensureNotDisposed();
    return this.resolveInternal<T>(token, []);
  }

  /**
   * Resolve a dependency asynchronously.
   * Supports async factory providers.
   */
  async resolveAsync<T>(token: Token<T>): Promise<T> {
    this.ensureNotDisposed();
    return this.resolveAsyncInternal<T>(token, []);
  }

  /**
   * Check if a token is registered in this container or any parent.
   */
  has(token: Token): boolean {
    if (this.registrations.has(token) || this.singletons.has(token)) {
      return true;
    }
    return this.parent?.has(token) ?? false;
  }

  /**
   * Create a scoped container.
   * Scoped instances are unique within this scope.
   * Singletons are still shared from the parent.
   */
  createScope(): Container {
    this.ensureNotDisposed();
    const scope = new Container({ parent: this, isScope: true });
    this.children.add(scope);
    return scope;
  }

  /**
   * Create a child container.
   * Child containers inherit registrations from parent but can override them.
   * Unlike scopes, children can have their own singleton instances.
   */
  createChild(): Container {
    this.ensureNotDisposed();
    const child = new Container({ parent: this, isScope: false });
    this.children.add(child);
    return child;
  }

  /**
   * Dispose the container and all scoped instances.
   * Calls dispose() on instances that implement Disposable.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    // Dispose children first
    const childDisposals = [...this.children].map((child) =>
      child.dispose(),
    );
    await Promise.all(childDisposals);
    this.children.clear();

    // Dispose scoped instances
    for (const instance of this.scopedInstances.values()) {
      if (isDisposable(instance)) {
        await instance.dispose();
      }
    }
    this.scopedInstances.clear();

    // Dispose singletons (only if this is the root or a child, not a scope)
    if (!this.isScope) {
      for (const instance of this.singletons.values()) {
        if (isDisposable(instance)) {
          await instance.dispose();
        }
      }
      this.singletons.clear();
    }

    // Remove self from parent
    if (this.parent) {
      this.parent.children.delete(this);
    }
  }

  /**
   * Get all registered tokens
   */
  getRegisteredTokens(): Token[] {
    return [...this.registrations.keys()];
  }

  // ─── Internal Resolution ──────────────────────────────────────────────

  private resolveInternal<T>(token: Token<T>, chain: Token[]): T {
    // Check for circular dependency
    if (this.resolving.has(token)) {
      const names = [...chain, token].map(getTokenName);
      throw new CircularDependencyError(names);
    }

    // Check scoped instances first (for scope containers)
    if (this.isScope && this.scopedInstances.has(token)) {
      return this.scopedInstances.get(token) as T;
    }

    // Check singletons
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Find registration
    const registration = this.findRegistration<T>(token);
    if (!registration) {
      throw new DependencyResolutionError(token);
    }

    const { provider, scope } = registration;

    // For singletons in a scope, delegate to parent
    if (this.isScope && scope === Scope.Singleton && this.parent) {
      if (this.parent.singletons.has(token)) {
        return this.parent.singletons.get(token) as T;
      }
    }

    // Mark as resolving for circular dependency detection
    this.resolving.add(token);
    chain.push(token);

    try {
      const instance = this.createInstance<T>(provider, chain);

      // Store based on scope
      if (scope === Scope.Singleton) {
        if (this.isScope && this.parent) {
          this.parent.singletons.set(token, instance);
        } else {
          this.singletons.set(token, instance);
        }
      } else if (scope === Scope.Scoped) {
        this.scopedInstances.set(token, instance);
      }
      // Transient: don't store, new instance every time

      return instance;
    } finally {
      this.resolving.delete(token);
      chain.pop();
    }
  }

  private async resolveAsyncInternal<T>(
    token: Token<T>,
    chain: Token[],
  ): Promise<T> {
    // Check for circular dependency
    if (this.resolving.has(token)) {
      const names = [...chain, token].map(getTokenName);
      throw new CircularDependencyError(names);
    }

    // Check scoped instances first (for scope containers)
    if (this.isScope && this.scopedInstances.has(token)) {
      return this.scopedInstances.get(token) as T;
    }

    // Check singletons
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Find registration
    const registration = this.findRegistration<T>(token);
    if (!registration) {
      throw new DependencyResolutionError(token);
    }

    const { provider, scope } = registration;

    // For singletons in a scope, delegate to parent
    if (this.isScope && scope === Scope.Singleton && this.parent) {
      if (this.parent.singletons.has(token)) {
        return this.parent.singletons.get(token) as T;
      }
    }

    // Mark as resolving for circular dependency detection
    this.resolving.add(token);
    chain.push(token);

    try {
      const instance = await this.createInstanceAsync<T>(
        provider,
        chain,
      );

      // Store based on scope
      if (scope === Scope.Singleton) {
        if (this.isScope && this.parent) {
          this.parent.singletons.set(token, instance);
        } else {
          this.singletons.set(token, instance);
        }
      } else if (scope === Scope.Scoped) {
        this.scopedInstances.set(token, instance);
      }

      return instance;
    } finally {
      this.resolving.delete(token);
      chain.pop();
    }
  }

  private findRegistration<T>(
    token: Token<T>,
  ): Registration<T> | undefined {
    const local = this.registrations.get(token);
    if (local) return local as Registration<T>;
    return this.parent?.findRegistration(token);
  }

  private createInstance<T>(
    provider: Provider<T> | { provide: Token<T>; useClass: Constructor<T> },
    chain: Token[],
  ): T {
    if (isValueProvider(provider as Provider<T>)) {
      return (provider as { useValue: T }).useValue;
    }

    if (isExistingProvider(provider as Provider<T>)) {
      const existing = (provider as { useExisting: Token<T> })
        .useExisting;
      return this.resolveInternal<T>(existing, chain);
    }

    if (isFactoryProvider(provider as Provider<T>)) {
      const factoryProvider = provider as {
        useFactory: (...args: unknown[]) => T | Promise<T>;
        inject?: Token[];
      };
      const deps = (factoryProvider.inject ?? []).map((dep) =>
        this.resolveInternal(dep, chain),
      );
      const result = factoryProvider.useFactory(...deps);
      if (result instanceof Promise) {
        throw new DependencyResolutionError(
          (provider as { provide: Token<T> }).provide,
          "Factory returned a Promise. Use resolveAsync() for async factories.",
        );
      }
      return result;
    }

    // ClassProvider or auto-registered constructor
    const ctor = (provider as { useClass: Constructor<T> }).useClass;
    return this.instantiateClass<T>(ctor, chain);
  }

  private async createInstanceAsync<T>(
    provider: Provider<T> | { provide: Token<T>; useClass: Constructor<T> },
    chain: Token[],
  ): Promise<T> {
    if (isValueProvider(provider as Provider<T>)) {
      return (provider as { useValue: T }).useValue;
    }

    if (isExistingProvider(provider as Provider<T>)) {
      const existing = (provider as { useExisting: Token<T> })
        .useExisting;
      return this.resolveAsyncInternal<T>(existing, chain);
    }

    if (isFactoryProvider(provider as Provider<T>)) {
      const factoryProvider = provider as {
        useFactory: (...args: unknown[]) => T | Promise<T>;
        inject?: Token[];
      };
      const deps: unknown[] = [];
      for (const dep of factoryProvider.inject ?? []) {
        deps.push(await this.resolveAsyncInternal(dep, chain));
      }
      return factoryProvider.useFactory(...deps);
    }

    // ClassProvider
    const ctor = (provider as { useClass: Constructor<T> }).useClass;
    return this.instantiateClassAsync<T>(ctor, chain);
  }

  private instantiateClass<T>(
    ctor: Constructor<T>,
    chain: Token[],
  ): T {
    const injectTokens = getInjectTokens(ctor);
    const optionalParams = getOptionalParams(ctor);
    const paramCount = Math.max(
      ctor.length,
      injectTokens.size > 0
        ? Math.max(...injectTokens.keys()) + 1
        : 0,
    );

    const args: unknown[] = [];
    for (let i = 0; i < paramCount; i++) {
      const token = injectTokens.get(i);
      if (token !== undefined) {
        const isOptional = optionalParams.has(i);
        try {
          args.push(this.resolveInternal(token, chain));
        } catch (err) {
          if (isOptional && err instanceof DependencyResolutionError) {
            args.push(undefined);
          } else {
            throw err;
          }
        }
      } else {
        args.push(undefined);
      }
    }

    return new ctor(...args);
  }

  private async instantiateClassAsync<T>(
    ctor: Constructor<T>,
    chain: Token[],
  ): Promise<T> {
    const injectTokens = getInjectTokens(ctor);
    const optionalParams = getOptionalParams(ctor);
    const paramCount = Math.max(
      ctor.length,
      injectTokens.size > 0
        ? Math.max(...injectTokens.keys()) + 1
        : 0,
    );

    const args: unknown[] = [];
    for (let i = 0; i < paramCount; i++) {
      const token = injectTokens.get(i);
      if (token !== undefined) {
        const isOptional = optionalParams.has(i);
        try {
          args.push(
            await this.resolveAsyncInternal(token, chain),
          );
        } catch (err) {
          if (isOptional && err instanceof DependencyResolutionError) {
            args.push(undefined);
          } else {
            throw err;
          }
        }
      } else {
        args.push(undefined);
      }
    }

    return new ctor(...args);
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Container has been disposed");
    }
  }
}
