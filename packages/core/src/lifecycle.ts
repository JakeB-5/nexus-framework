// @nexus/core - Lifecycle manager

import { LifecycleError } from "./errors.js";
import { HookExecutor, HookNames, HookRegistry } from "./hooks.js";
import { hasOnInit, hasOnReady, hasOnDestroy } from "./types.js";
import { getClassName } from "./utils.js";

/**
 * Manages the lifecycle of provider instances.
 * Orchestrates init → ready → destroy phases in proper order.
 */
export class LifecycleManager {
  private instances: Array<{ name: string; instance: unknown }> = [];
  private initialized = false;
  private ready = false;
  private destroying = false;
  private readonly hookRegistry: HookRegistry;
  private readonly hookExecutor: HookExecutor;

  constructor(hookRegistry?: HookRegistry) {
    this.hookRegistry = hookRegistry ?? new HookRegistry();
    this.hookExecutor = new HookExecutor(this.hookRegistry);
  }

  /**
   * Register an instance to be managed by the lifecycle.
   * Instances are initialized in registration order and destroyed in reverse order.
   */
  addInstance(instance: unknown, name?: string): void {
    const instanceName =
      name ??
      (instance !== null && typeof instance === "object"
        ? getClassName(instance)
        : "unknown");
    this.instances.push({ name: instanceName, instance });
  }

  /**
   * Run the init phase on all registered instances.
   * Calls onInit() on instances that implement OnInit.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.hookExecutor.execute(HookNames.BEFORE_INIT, {
      phase: "init",
    });

    for (const { name, instance } of this.instances) {
      if (hasOnInit(instance)) {
        try {
          await instance.onInit();
        } catch (err) {
          throw new LifecycleError("init", name, undefined, {
            cause: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    this.initialized = true;
    await this.hookExecutor.execute(HookNames.AFTER_INIT, {
      phase: "init",
    });
  }

  /**
   * Run the ready phase on all registered instances.
   * Must be called after init(). Calls onReady() on instances that implement OnReady.
   */
  async ready_(): Promise<void> {
    if (!this.initialized) {
      throw new LifecycleError(
        "ready",
        "LifecycleManager",
        "Cannot enter ready phase before init phase",
      );
    }
    if (this.ready) return;

    await this.hookExecutor.execute(HookNames.BEFORE_READY, {
      phase: "ready",
    });

    for (const { name, instance } of this.instances) {
      if (hasOnReady(instance)) {
        try {
          await instance.onReady();
        } catch (err) {
          throw new LifecycleError("ready", name, undefined, {
            cause: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    this.ready = true;
    await this.hookExecutor.execute(HookNames.AFTER_READY, {
      phase: "ready",
    });
  }

  /**
   * Run the destroy phase on all registered instances in reverse order.
   * Calls onDestroy() on instances that implement OnDestroy.
   */
  async destroy(): Promise<void> {
    if (this.destroying) return;
    this.destroying = true;

    await this.hookExecutor.execute(HookNames.BEFORE_DESTROY, {
      phase: "destroy",
    });

    // Destroy in reverse order
    const reversed = [...this.instances].reverse();
    const errors: LifecycleError[] = [];

    for (const { name, instance } of reversed) {
      if (hasOnDestroy(instance)) {
        try {
          await instance.onDestroy();
        } catch (err) {
          errors.push(
            new LifecycleError("destroy", name, undefined, {
              cause: err instanceof Error ? err : new Error(String(err)),
            }),
          );
        }
      }
    }

    this.initialized = false;
    this.ready = false;
    this.destroying = false;
    this.instances = [];

    await this.hookExecutor.execute(HookNames.AFTER_DESTROY, {
      phase: "destroy",
    });

    if (errors.length > 0) {
      throw new LifecycleError(
        "destroy",
        "LifecycleManager",
        `${errors.length} error(s) during destroy phase: ${errors.map((e) => e.message).join("; ")}`,
      );
    }
  }

  /**
   * Graceful shutdown with a timeout.
   * If destroy doesn't complete within the timeout, it will be forced.
   */
  async gracefulShutdown(timeoutMs: number = 10000): Promise<void> {
    const timeoutPromise = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), timeoutMs);
    });

    const result = await Promise.race([
      this.destroy().then(() => "done" as const),
      timeoutPromise,
    ]);

    if (result === "timeout") {
      throw new LifecycleError(
        "shutdown",
        "LifecycleManager",
        `Graceful shutdown timed out after ${timeoutMs}ms`,
      );
    }
  }

  /**
   * Get the hook registry for adding lifecycle hooks.
   */
  getHookRegistry(): HookRegistry {
    return this.hookRegistry;
  }

  /**
   * Check if the manager has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if the manager is in ready state
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get count of managed instances
   */
  getInstanceCount(): number {
    return this.instances.length;
  }
}

/**
 * Signal handler that triggers graceful shutdown.
 * Listens for SIGINT and SIGTERM.
 */
export class SignalHandler {
  private handlers: Array<{ signal: string; handler: () => void }> = [];
  private active = false;

  /**
   * Start listening for OS signals.
   * When a signal is received, the callback is invoked.
   */
  listen(callback: () => Promise<void> | void): void {
    if (this.active) return;
    this.active = true;

    const signals = ["SIGINT", "SIGTERM"];
    for (const signal of signals) {
      const handler = () => {
        this.stop();
        void callback();
      };
      this.handlers.push({ signal, handler });
      process.on(signal, handler);
    }
  }

  /**
   * Stop listening for signals.
   */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    for (const { signal, handler } of this.handlers) {
      process.removeListener(signal, handler);
    }
    this.handlers = [];
  }
}
