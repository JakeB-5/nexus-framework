// @nexus/core - Hook system for pre/post execution hooks

import { HookExecutionError } from "./errors.js";
import type { HookFunction, HookOptions, HookRegistration } from "./types.js";

/**
 * Registry for managing named hook chains.
 * Hooks are organized by name and executed in priority order.
 */
export class HookRegistry {
  private hooks = new Map<string, HookRegistration[]>();

  /**
   * Register a hook function under a given name.
   * Lower priority values run first (default: 100).
   */
  register<T = unknown>(
    name: string,
    hook: HookFunction<T>,
    options?: HookOptions,
  ): () => void {
    const registration: HookRegistration<T> = {
      hook: hook as HookFunction,
      priority: options?.priority ?? 100,
      label: options?.label,
    };

    let chain = this.hooks.get(name);
    if (!chain) {
      chain = [];
      this.hooks.set(name, chain);
    }
    chain.push(registration as HookRegistration);

    // Keep sorted by priority
    chain.sort((a, b) => a.priority - b.priority);

    // Return unsubscribe function
    return () => {
      const current = this.hooks.get(name);
      if (current) {
        const idx = current.indexOf(registration as HookRegistration);
        if (idx !== -1) {
          current.splice(idx, 1);
        }
        if (current.length === 0) {
          this.hooks.delete(name);
        }
      }
    };
  }

  /**
   * Get all registrations for a hook name, sorted by priority.
   */
  getHooks(name: string): ReadonlyArray<HookRegistration> {
    return this.hooks.get(name) ?? [];
  }

  /**
   * Check if any hooks are registered for a name.
   */
  hasHooks(name: string): boolean {
    const chain = this.hooks.get(name);
    return chain !== undefined && chain.length > 0;
  }

  /**
   * Remove all hooks for a given name.
   */
  clear(name: string): void {
    this.hooks.delete(name);
  }

  /**
   * Remove all hooks from the registry.
   */
  clearAll(): void {
    this.hooks.clear();
  }

  /**
   * Get all registered hook names.
   */
  getNames(): string[] {
    return [...this.hooks.keys()];
  }
}

/**
 * Executor for running hook chains with error handling.
 */
export class HookExecutor {
  private readonly registry: HookRegistry;

  constructor(registry: HookRegistry) {
    this.registry = registry;
  }

  /**
   * Execute all hooks for a given name sequentially.
   * Hooks run in priority order (lower values first).
   * If a hook throws, execution stops and the error is propagated.
   */
  async execute<T>(name: string, context: T): Promise<void> {
    const hooks = this.registry.getHooks(name);

    for (const registration of hooks) {
      try {
        await registration.hook(context);
      } catch (err) {
        const label = registration.label ?? "unnamed";
        throw new HookExecutionError(name, `Hook "${label}" failed during "${name}"`, {
          cause: err instanceof Error ? err : new Error(String(err)),
          context: { label, priority: registration.priority },
        });
      }
    }
  }

  /**
   * Execute all hooks, collecting errors instead of stopping at the first.
   * Returns an array of errors (empty if all succeeded).
   */
  async executeAll<T>(
    name: string,
    context: T,
  ): Promise<HookExecutionError[]> {
    const hooks = this.registry.getHooks(name);
    const errors: HookExecutionError[] = [];

    for (const registration of hooks) {
      try {
        await registration.hook(context);
      } catch (err) {
        const label = registration.label ?? "unnamed";
        errors.push(
          new HookExecutionError(name, `Hook "${label}" failed during "${name}"`, {
            cause: err instanceof Error ? err : new Error(String(err)),
            context: { label, priority: registration.priority },
          }),
        );
      }
    }

    return errors;
  }

  /**
   * Execute hooks with a timeout per hook.
   * If a hook exceeds the timeout, it's treated as an error.
   */
  async executeWithTimeout<T>(
    name: string,
    context: T,
    timeoutMs: number,
  ): Promise<void> {
    const hooks = this.registry.getHooks(name);

    for (const registration of hooks) {
      const label = registration.label ?? "unnamed";
      try {
        await Promise.race([
          registration.hook(context),
          createTimeout(
            timeoutMs,
            `Hook "${label}" timed out after ${timeoutMs}ms during "${name}"`,
          ),
        ]);
      } catch (err) {
        throw new HookExecutionError(name, undefined, {
          cause: err instanceof Error ? err : new Error(String(err)),
          context: { label, priority: registration.priority, timeoutMs },
        });
      }
    }
  }
}

/**
 * Create a promise that rejects after a timeout
 */
function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Well-known hook names used by the framework
 */
export const HookNames = {
  BEFORE_INIT: "nexus:before:init",
  AFTER_INIT: "nexus:after:init",
  BEFORE_READY: "nexus:before:ready",
  AFTER_READY: "nexus:after:ready",
  BEFORE_DESTROY: "nexus:before:destroy",
  AFTER_DESTROY: "nexus:after:destroy",
  BEFORE_RESOLVE: "nexus:before:resolve",
  AFTER_RESOLVE: "nexus:after:resolve",
  BEFORE_MODULE_INIT: "nexus:before:module:init",
  AFTER_MODULE_INIT: "nexus:after:module:init",
} as const;
