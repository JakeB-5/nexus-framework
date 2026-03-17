// @nexus/core - Public API

// Types
export {
  type Constructor,
  type AbstractConstructor,
  type Token,
  Scope,
  type ClassProvider,
  type ValueProvider,
  type FactoryProvider,
  type ExistingProvider,
  type Provider,
  isClassProvider,
  isValueProvider,
  isFactoryProvider,
  isExistingProvider,
  type RegistrationOptions,
  type ModuleMetadata,
  type DynamicModule,
  type OnInit,
  type OnReady,
  type OnDestroy,
  hasOnInit,
  hasOnReady,
  hasOnDestroy,
  type Disposable,
  isDisposable,
  type HookFunction,
  type HookOptions,
  type HookRegistration,
  type ApplicationOptions,
} from "./types.js";

// Errors
export {
  NexusError,
  DependencyResolutionError,
  CircularDependencyError,
  ModuleInitializationError,
  LifecycleError,
  HookExecutionError,
  InvalidModuleError,
} from "./errors.js";

// Container
export { Container } from "./container.js";

// Decorators
export {
  Injectable,
  Inject,
  Optional,
  Module,
  getInjectableMetadata,
  isInjectable,
  getInjectTokens,
  getOptionalParams,
  getModuleMetadata,
  isModule,
  setParamCount,
  getParamCount,
  setInjectableMetadata,
  setModuleMetadata,
} from "./decorators.js";

// Module system
export { ModuleLoader, NexusApplication } from "./module.js";

// Lifecycle
export { LifecycleManager, SignalHandler } from "./lifecycle.js";

// Hooks
export { HookRegistry, HookExecutor, HookNames } from "./hooks.js";

// Utilities
export {
  getTokenName,
  getClassName,
  isConstructor,
  createToken,
  topologicalSort,
  deepMerge,
  generateId,
  tokenToString,
} from "./utils.js";
