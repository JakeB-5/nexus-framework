// @nexus/core - Core type definitions

/**
 * Constructor type utility - represents a class that can be instantiated
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Abstract constructor type - represents an abstract class
 */
export type AbstractConstructor<T = unknown> = abstract new (
  ...args: unknown[]
) => T;

/**
 * Token type - used to identify dependencies in the container
 * Can be a string, symbol, or constructor function
 */
export type Token<T = unknown> = string | symbol | Constructor<T>;

/**
 * Scope enum - defines the lifetime of a registered dependency
 */
export enum Scope {
  /** Single instance shared across the container and all child containers */
  Singleton = "singleton",
  /** New instance created every time the dependency is resolved */
  Transient = "transient",
  /** Single instance within a scope; different scopes get different instances */
  Scoped = "scoped",
}

/**
 * Provider types - different ways to register dependencies
 */
export interface ClassProvider<T = unknown> {
  provide: Token<T>;
  useClass: Constructor<T>;
  scope?: Scope;
}

export interface ValueProvider<T = unknown> {
  provide: Token<T>;
  useValue: T;
}

export interface FactoryProvider<T = unknown> {
  provide: Token<T>;
  useFactory: (...args: unknown[]) => T | Promise<T>;
  inject?: Token[];
  scope?: Scope;
}

export interface ExistingProvider<T = unknown> {
  provide: Token<T>;
  useExisting: Token<T>;
}

export type Provider<T = unknown> =
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

/**
 * Type guards for providers
 */
export function isClassProvider<T>(
  provider: Provider<T>,
): provider is ClassProvider<T> {
  return "useClass" in provider;
}

export function isValueProvider<T>(
  provider: Provider<T>,
): provider is ValueProvider<T> {
  return "useValue" in provider;
}

export function isFactoryProvider<T>(
  provider: Provider<T>,
): provider is FactoryProvider<T> {
  return "useFactory" in provider;
}

export function isExistingProvider<T>(
  provider: Provider<T>,
): provider is ExistingProvider<T> {
  return "useExisting" in provider;
}

/**
 * Registration options for the container
 */
export interface RegistrationOptions {
  scope?: Scope;
}

/**
 * Module metadata - defines a module's dependencies and exports
 */
export interface ModuleMetadata {
  /** Other modules this module depends on */
  imports?: Array<Constructor | DynamicModule>;
  /** Providers registered in this module */
  providers?: Array<Provider | Constructor>;
  /** Providers exported for use by importing modules */
  exports?: Array<Token | Provider | Constructor>;
  /** Whether this module is global (available everywhere without importing) */
  global?: boolean;
}

/**
 * Dynamic module - a module that can be configured at runtime
 */
export interface DynamicModule {
  module: Constructor;
  imports?: Array<Constructor | DynamicModule>;
  providers?: Array<Provider | Constructor>;
  exports?: Array<Token | Provider | Constructor>;
  global?: boolean;
}

/**
 * Lifecycle interfaces - implemented by providers to hook into lifecycle events
 */
export interface OnInit {
  onInit(): void | Promise<void>;
}

export interface OnReady {
  onReady(): void | Promise<void>;
}

export interface OnDestroy {
  onDestroy(): void | Promise<void>;
}

/**
 * Type guard helpers for lifecycle interfaces
 */
export function hasOnInit(instance: unknown): instance is OnInit {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "onInit" in instance &&
    typeof (instance as OnInit).onInit === "function"
  );
}

export function hasOnReady(instance: unknown): instance is OnReady {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "onReady" in instance &&
    typeof (instance as OnReady).onReady === "function"
  );
}

export function hasOnDestroy(instance: unknown): instance is OnDestroy {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "onDestroy" in instance &&
    typeof (instance as OnDestroy).onDestroy === "function"
  );
}

/**
 * Disposable interface for cleanup
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

export function isDisposable(instance: unknown): instance is Disposable {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "dispose" in instance &&
    typeof (instance as Disposable).dispose === "function"
  );
}

/**
 * Hook types
 */
export type HookFunction<T = unknown> = (context: T) => void | Promise<void>;

export interface HookOptions {
  /** Priority for ordering (lower runs first) */
  priority?: number;
  /** Label for debugging */
  label?: string;
}

export interface HookRegistration<T = unknown> {
  hook: HookFunction<T>;
  priority: number;
  label?: string;
}

/**
 * Application options
 */
export interface ApplicationOptions {
  /** Timeout for graceful shutdown in milliseconds */
  shutdownTimeout?: number;
  /** Whether to handle OS signals (SIGINT, SIGTERM) */
  handleSignals?: boolean;
}
