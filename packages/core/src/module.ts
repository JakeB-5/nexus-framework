// @nexus/core - Module system and application bootstrap

import { Container } from "./container.js";
import {
  getModuleMetadata,
} from "./decorators.js";
import {
  CircularDependencyError,
  InvalidModuleError,
  ModuleInitializationError,
} from "./errors.js";
import { LifecycleManager, SignalHandler } from "./lifecycle.js";
import { HookRegistry } from "./hooks.js";
import type {
  Constructor,
  DynamicModule,
  ModuleMetadata,
  Provider,
  Token,
  ApplicationOptions,
} from "./types.js";
import {
  hasOnInit,
  hasOnReady,
  hasOnDestroy,
} from "./types.js";
import { getClassName, isConstructor, topologicalSort } from "./utils.js";

// ─── Module Loader ────────────────────────────────────────────────────────

interface ResolvedModule {
  target: Constructor;
  metadata: ModuleMetadata;
  isDynamic: boolean;
}

/**
 * Loads and processes @Module decorated classes.
 * Resolves module dependencies, detects circular modules,
 * and registers providers in the container.
 */
export class ModuleLoader {
  private readonly container: Container;
  private readonly resolvedModules = new Map<Constructor, ResolvedModule>();
  private readonly moduleOrder: Constructor[] = [];
  private readonly globalProviders = new Map<Token, Provider | Constructor>();

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Load a module and all its dependencies recursively.
   */
  async loadModule(
    moduleOrDynamic: Constructor | DynamicModule,
  ): Promise<void> {
    await this.resolveModule(moduleOrDynamic, new Set());
    this.computeModuleOrder();
    this.registerAllProviders();
  }

  /**
   * Get the resolved modules in dependency order.
   */
  getModuleOrder(): Constructor[] {
    return [...this.moduleOrder];
  }

  /**
   * Get all resolved modules.
   */
  getResolvedModules(): ReadonlyMap<Constructor, ResolvedModule> {
    return this.resolvedModules;
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private async resolveModule(
    moduleOrDynamic: Constructor | DynamicModule,
    visiting: Set<Constructor>,
  ): Promise<void> {
    let target: Constructor;
    let metadata: ModuleMetadata;
    let isDynamic = false;

    if (isConstructor(moduleOrDynamic)) {
      target = moduleOrDynamic;
      if (this.resolvedModules.has(target)) return;

      const meta = getModuleMetadata(target);
      if (!meta) {
        throw new InvalidModuleError(
          getClassName(target),
          `Class ${getClassName(target)} is not decorated with @Module`,
        );
      }
      metadata = meta;
    } else {
      const dynamicModule = moduleOrDynamic as DynamicModule;
      target = dynamicModule.module;
      if (this.resolvedModules.has(target)) return;

      isDynamic = true;
      // Merge dynamic module config with static metadata
      const staticMeta = getModuleMetadata(target) ?? {};
      metadata = {
        imports: dynamicModule.imports ?? staticMeta.imports,
        providers: dynamicModule.providers ?? staticMeta.providers,
        exports: dynamicModule.exports ?? staticMeta.exports,
        global: dynamicModule.global ?? staticMeta.global,
      };
    }

    // Circular module detection
    if (visiting.has(target)) {
      const chain = [...visiting, target].map(getClassName);
      throw new CircularDependencyError(chain);
    }

    visiting.add(target);

    // Resolve imported modules first
    if (metadata.imports) {
      for (const imported of metadata.imports) {
        await this.resolveModule(imported, new Set(visiting));
      }
    }

    this.resolvedModules.set(target, { target, metadata, isDynamic });
    visiting.delete(target);
  }

  private computeModuleOrder(): void {
    const nodes = [...this.resolvedModules.keys()];
    const edges = new Map<Constructor, Set<Constructor>>();

    for (const [target, resolved] of this.resolvedModules) {
      const deps = new Set<Constructor>();
      if (resolved.metadata.imports) {
        for (const imp of resolved.metadata.imports) {
          const depTarget = isConstructor(imp)
            ? imp
            : (imp as DynamicModule).module;
          deps.add(depTarget);
        }
      }
      edges.set(target, deps);
    }

    try {
      this.moduleOrder.length = 0;
      this.moduleOrder.push(...topologicalSort(nodes, edges));
    } catch (err) {
      throw new ModuleInitializationError(
        "ModuleLoader",
        `Failed to determine module order: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private registerAllProviders(): void {
    // First pass: collect global providers
    for (const moduleCtor of this.moduleOrder) {
      const resolved = this.resolvedModules.get(moduleCtor)!;
      if (resolved.metadata.global) {
        this.collectExports(resolved);
      }
    }

    // Second pass: register all providers
    for (const moduleCtor of this.moduleOrder) {
      const resolved = this.resolvedModules.get(moduleCtor)!;

      // Register the module class itself
      this.container.register(moduleCtor);

      // Register providers
      if (resolved.metadata.providers) {
        for (const provider of resolved.metadata.providers) {
          if (isConstructor(provider)) {
            this.container.register(provider);
          } else {
            this.container.register(provider as Provider);
          }
        }
      }
    }

    // Register global providers
    for (const [token, provider] of this.globalProviders) {
      if (!this.container.has(token)) {
        if (isConstructor(provider)) {
          this.container.register(provider);
        } else {
          this.container.register(provider as Provider);
        }
      }
    }
  }

  private collectExports(resolved: ResolvedModule): void {
    if (!resolved.metadata.exports) return;

    for (const exported of resolved.metadata.exports) {
      if (isConstructor(exported)) {
        this.globalProviders.set(exported, exported);
      } else if (
        typeof exported === "object" &&
        "provide" in (exported as Provider)
      ) {
        const provider = exported as Provider;
        this.globalProviders.set(provider.provide, provider);
      } else {
        // Token reference - find the corresponding provider
        const token = exported as Token;
        if (resolved.metadata.providers) {
          for (const p of resolved.metadata.providers) {
            if (!isConstructor(p) && (p as Provider).provide === token) {
              this.globalProviders.set(token, p as Provider);
              break;
            }
          }
        }
      }
    }
  }
}

// ─── NexusApplication ─────────────────────────────────────────────────────

/**
 * Main application class that bootstraps the root module,
 * initializes the DI container, and manages the application lifecycle.
 */
export class NexusApplication {
  private readonly container: Container;
  private readonly lifecycleManager: LifecycleManager;
  private readonly hookRegistry: HookRegistry;
  private readonly signalHandler: SignalHandler;
  private readonly options: Required<ApplicationOptions>;
  private moduleLoader: ModuleLoader | undefined;
  private running = false;

  private constructor(options: ApplicationOptions = {}) {
    this.hookRegistry = new HookRegistry();
    this.container = new Container();
    this.lifecycleManager = new LifecycleManager(this.hookRegistry);
    this.signalHandler = new SignalHandler();
    this.options = {
      shutdownTimeout: options.shutdownTimeout ?? 10000,
      handleSignals: options.handleSignals ?? true,
    };

    // Register core services in the container
    this.container.registerValue("NexusApplication", this);
    this.container.registerValue("Container", this.container);
    this.container.registerValue("LifecycleManager", this.lifecycleManager);
    this.container.registerValue("HookRegistry", this.hookRegistry);
  }

  /**
   * Create and bootstrap a NexusApplication from a root module.
   */
  static async create(
    rootModule: Constructor | DynamicModule,
    options?: ApplicationOptions,
  ): Promise<NexusApplication> {
    const app = new NexusApplication(options);
    await app.bootstrap(rootModule);
    return app;
  }

  /**
   * Get the DI container
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Resolve a provider from the container
   */
  resolve<T>(token: Token<T>): T {
    return this.container.resolve(token);
  }

  /**
   * Get the lifecycle manager
   */
  getLifecycleManager(): LifecycleManager {
    return this.lifecycleManager;
  }

  /**
   * Get the hook registry
   */
  getHookRegistry(): HookRegistry {
    return this.hookRegistry;
  }

  /**
   * Start the application (init → ready phases)
   */
  async start(): Promise<void> {
    if (this.running) return;

    if (this.options.handleSignals) {
      this.signalHandler.listen(() => this.stop());
    }

    await this.lifecycleManager.init();
    await this.lifecycleManager.ready_();
    this.running = true;
  }

  /**
   * Stop the application gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    this.signalHandler.stop();
    await this.lifecycleManager.gracefulShutdown(
      this.options.shutdownTimeout,
    );
    await this.container.dispose();
  }

  /**
   * Check if the application is running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private async bootstrap(
    rootModule: Constructor | DynamicModule,
  ): Promise<void> {
    this.moduleLoader = new ModuleLoader(this.container);

    try {
      await this.moduleLoader.loadModule(rootModule);
    } catch (err) {
      const moduleName = isConstructor(rootModule)
        ? getClassName(rootModule)
        : getClassName((rootModule as DynamicModule).module);
      throw new ModuleInitializationError(moduleName, undefined, {
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }

    // Register lifecycle hooks for all resolved instances
    const moduleOrder = this.moduleLoader.getModuleOrder();
    for (const moduleCtor of moduleOrder) {
      // Resolve the module instance and register for lifecycle
      try {
        const moduleInstance = this.container.resolve(moduleCtor);
        if (
          hasOnInit(moduleInstance) ||
          hasOnReady(moduleInstance) ||
          hasOnDestroy(moduleInstance)
        ) {
          this.lifecycleManager.addInstance(
            moduleInstance,
            getClassName(moduleCtor),
          );
        }
      } catch {
        // Module itself might not need resolving if it has no lifecycle hooks
      }

      // Also resolve and register providers that have lifecycle hooks
      const resolved = this.moduleLoader.getResolvedModules().get(moduleCtor);
      if (resolved?.metadata.providers) {
        for (const provider of resolved.metadata.providers) {
          try {
            const token = isConstructor(provider)
              ? provider
              : (provider as Provider).provide;
            if (token === moduleCtor) continue; // Already handled

            const instance = this.container.resolve(token);
            if (
              hasOnInit(instance) ||
              hasOnReady(instance) ||
              hasOnDestroy(instance)
            ) {
              this.lifecycleManager.addInstance(
                instance,
                typeof token === "function"
                  ? getClassName(token as Constructor)
                  : String(token),
              );
            }
          } catch {
            // Skip providers that can't be resolved at bootstrap time
          }
        }
      }
    }
  }
}
