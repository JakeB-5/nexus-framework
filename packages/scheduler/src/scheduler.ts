// Scheduler class - main entry point for cron-like job scheduling

import { getNextDate } from "./cron-parser.js";
import { SchedulerError } from "./errors.js";
import { ScheduledJob } from "./scheduled-job.js";
import type {
  JobStatus,
  ScheduledJobHandler,
  ScheduledJobOptions,
  SchedulerOptions,
} from "./types.js";

export class Scheduler {
  private readonly jobs = new Map<string, ScheduledJob>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = false;
  private readonly options: SchedulerOptions;

  constructor(options: SchedulerOptions = {}) {
    this.options = {
      autoStart: false,
      ...options,
    };

    if (this.options.autoStart) {
      this.start();
    }
  }

  schedule(
    name: string,
    cronExpr: string,
    handler: ScheduledJobHandler,
    options?: ScheduledJobOptions,
  ): ScheduledJob {
    if (this.jobs.has(name)) {
      throw new SchedulerError(`Job "${name}" is already scheduled`);
    }

    const job = new ScheduledJob(name, cronExpr, handler, options);
    this.jobs.set(name, job);

    if (this.running && job.state !== "disabled") {
      this.scheduleNext(job);

      if (options?.runOnInit) {
        void job.execute();
      }
    }

    return job;
  }

  unschedule(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      return false;
    }

    this.clearJobTimer(name);
    this.jobs.delete(name);
    return true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const job of this.jobs.values()) {
      if (job.state !== "disabled") {
        this.scheduleNext(job);
      }
    }
  }

  stop(): void {
    this.running = false;
    for (const name of this.timers.keys()) {
      this.clearJobTimer(name);
    }
  }

  getJobs(): JobStatus[] {
    return Array.from(this.jobs.values()).map((job) => job.getStatus());
  }

  getJob(name: string): ScheduledJob | undefined {
    return this.jobs.get(name);
  }

  getNextRun(name: string): Date | undefined {
    const job = this.jobs.get(name);
    if (!job) {
      return undefined;
    }

    try {
      return getNextDate(job.cronExpression);
    } catch {
      return undefined;
    }
  }

  async runNow(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) {
      throw new SchedulerError(`Job "${name}" not found`);
    }

    await job.execute();
  }

  pauseJob(name: string): void {
    const job = this.jobs.get(name);
    if (!job) {
      throw new SchedulerError(`Job "${name}" not found`);
    }

    job.pause();
    this.clearJobTimer(name);
  }

  resumeJob(name: string): void {
    const job = this.jobs.get(name);
    if (!job) {
      throw new SchedulerError(`Job "${name}" not found`);
    }

    job.resume();
    if (this.running) {
      this.scheduleNext(job);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  jobCount(): number {
    return this.jobs.size;
  }

  private static readonly MAX_TIMEOUT = 2_147_483_647; // ~24.8 days, max for setTimeout

  private scheduleNext(job: ScheduledJob): void {
    if (!this.running) return;
    if (job.state === "disabled" || job.state === "paused") return;

    try {
      const nextDate = getNextDate(job.cronExpression);
      job.nextRun = nextDate.getTime();
      const delay = Math.max(0, nextDate.getTime() - Date.now());

      this.clearJobTimer(job.name);

      let timer: ReturnType<typeof setTimeout>;

      if (delay > Scheduler.MAX_TIMEOUT) {
        // Delay exceeds setTimeout's 32-bit limit; schedule an intermediate wakeup
        timer = setTimeout(() => {
          if (!this.running) return;
          this.scheduleNext(job);
        }, Scheduler.MAX_TIMEOUT);
      } else {
        timer = setTimeout(async () => {
          if (!this.running) return;

          await job.execute();

          // Schedule next execution if still running and job not disabled
          if (
            this.running &&
            job.state !== "disabled" &&
            job.state !== "paused"
          ) {
            this.scheduleNext(job);
          }
        }, delay);
      }

      if (timer.unref) {
        timer.unref();
      }

      this.timers.set(job.name, timer);
    } catch {
      // Failed to calculate next date - job won't run
    }
  }

  private clearJobTimer(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
    }
  }

  destroy(): void {
    this.stop();
    this.jobs.clear();
  }
}
