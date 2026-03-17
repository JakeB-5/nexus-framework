// Scheduler module integration

import { Scheduler } from "./scheduler.js";
import type { SchedulerOptions } from "./types.js";

export interface SchedulerModuleOptions extends SchedulerOptions {
  // Extension point for module-specific options
}

export class SchedulerModule {
  public readonly scheduler: Scheduler;

  constructor(options: SchedulerModuleOptions = {}) {
    this.scheduler = new Scheduler(options);
  }

  start(): void {
    this.scheduler.start();
  }

  stop(): void {
    this.scheduler.stop();
  }

  destroy(): void {
    this.scheduler.destroy();
  }
}
