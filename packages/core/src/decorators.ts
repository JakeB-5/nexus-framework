// @nexus/core - TypeScript decorators using WeakMaps (no reflect-metadata)

import type {
  Constructor,
  ModuleMetadata,
  RegistrationOptions,
  Token,
} from "./types.js";
import { Scope } from "./types.js";

// ─── Metadata Storage (WeakMaps) ──────────────────────────────────────────

/** Stores injectable metadata for classes */
const injectableMetadata = new WeakMap<
  Constructor,
  { scope: Scope }
>();

/** Stores injection tokens for constructor parameters: class → Map<paramIndex, token> */
const injectMetadata = new WeakMap<Constructor, Map<number, Token>>();

/** Stores optional flags for constructor parameters: class → Set<paramIndex> */
const optionalMetadata = new WeakMap<Constructor, Set<number>>();

/** Stores module metadata for classes decorated with @Module */
const moduleMetadata = new WeakMap<Constructor, ModuleMetadata>();

/** Stores parameter count for injectable classes */
const paramCountMetadata = new WeakMap<Constructor, number>();

// ─── Decorators ───────────────────────────────────────────────────────────

/**
 * Marks a class as injectable into the DI container.
 *
 * @example
 * ```ts
 * @Injectable()
 * class MyService { }
 *
 * @Injectable({ scope: Scope.Transient })
 * class TransientService { }
 * ```
 */
export function Injectable(
  options?: RegistrationOptions,
): (target: Constructor) => void {
  return (target: Constructor): void => {
    injectableMetadata.set(target, {
      scope: options?.scope ?? Scope.Singleton,
    });
  };
}

/**
 * Marks a constructor parameter for injection with a specific token.
 *
 * @example
 * ```ts
 * @Injectable()
 * class MyService {
 *   constructor(@Inject('CONFIG') private config: Config) {}
 * }
 * ```
 */
export function Inject(
  token: Token,
): (
  target: Constructor,
  _context: ClassFieldDecoratorContext | undefined,
  parameterIndex: number,
) => void {
  return (
    target: Constructor,
    _context: ClassFieldDecoratorContext | undefined,
    parameterIndex: number,
  ): void => {
    let params = injectMetadata.get(target);
    if (!params) {
      params = new Map();
      injectMetadata.set(target, params);
    }
    params.set(parameterIndex, token);
  };
}

/**
 * Marks a constructor parameter as optional.
 * If the dependency cannot be resolved, undefined will be injected.
 *
 * @example
 * ```ts
 * @Injectable()
 * class MyService {
 *   constructor(@Optional() @Inject('LOGGER') private logger?: Logger) {}
 * }
 * ```
 */
export function Optional(): (
  target: Constructor,
  _context: ClassFieldDecoratorContext | undefined,
  parameterIndex: number,
) => void {
  return (
    target: Constructor,
    _context: ClassFieldDecoratorContext | undefined,
    parameterIndex: number,
  ): void => {
    let optionals = optionalMetadata.get(target);
    if (!optionals) {
      optionals = new Set();
      optionalMetadata.set(target, optionals);
    }
    optionals.add(parameterIndex);
  };
}

/**
 * Defines a module with its dependencies, providers, and exports.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [DatabaseModule],
 *   providers: [UserService, UserRepository],
 *   exports: [UserService],
 * })
 * class UserModule {}
 * ```
 */
export function Module(
  metadata: ModuleMetadata,
): (target: Constructor) => void {
  return (target: Constructor): void => {
    moduleMetadata.set(target, metadata);
    // Also mark it as injectable singleton
    if (!injectableMetadata.has(target)) {
      injectableMetadata.set(target, { scope: Scope.Singleton });
    }
  };
}

// ─── Metadata Reflection Utilities ────────────────────────────────────────

/**
 * Get injectable metadata for a class
 */
export function getInjectableMetadata(
  target: Constructor,
): { scope: Scope } | undefined {
  return injectableMetadata.get(target);
}

/**
 * Check if a class is decorated with @Injectable
 */
export function isInjectable(target: Constructor): boolean {
  return injectableMetadata.has(target);
}

/**
 * Get the injection tokens for a class's constructor parameters
 */
export function getInjectTokens(
  target: Constructor,
): Map<number, Token> {
  return injectMetadata.get(target) ?? new Map();
}

/**
 * Get the set of optional parameter indices for a class
 */
export function getOptionalParams(target: Constructor): Set<number> {
  return optionalMetadata.get(target) ?? new Set();
}

/**
 * Get module metadata for a class
 */
export function getModuleMetadata(
  target: Constructor,
): ModuleMetadata | undefined {
  return moduleMetadata.get(target);
}

/**
 * Check if a class is decorated with @Module
 */
export function isModule(target: Constructor): boolean {
  return moduleMetadata.has(target);
}

/**
 * Set the expected parameter count for an injectable class.
 * This is used by the container to validate injection.
 */
export function setParamCount(
  target: Constructor,
  count: number,
): void {
  paramCountMetadata.set(target, count);
}

/**
 * Get the expected parameter count for an injectable class
 */
export function getParamCount(
  target: Constructor,
): number | undefined {
  return paramCountMetadata.get(target);
}

/**
 * Store injectable metadata directly (useful for programmatic registration)
 */
export function setInjectableMetadata(
  target: Constructor,
  metadata: { scope: Scope },
): void {
  injectableMetadata.set(target, metadata);
}

/**
 * Store module metadata directly (useful for programmatic module creation)
 */
export function setModuleMetadata(
  target: Constructor,
  metadata: ModuleMetadata,
): void {
  moduleMetadata.set(target, metadata);
}
