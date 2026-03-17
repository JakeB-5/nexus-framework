// ScheduledJob class - represents a single scheduled task

import type {
  JobExecution,
  JobState,
  JobStatus,
  ScheduledJobHandler,
  ScheduledJobOptions,
} from "./types.js";

const DEFAULT_MAX_FAILURES = 0; // 0 = never auto-disable

export class ScheduledJob {
  public readonly name: string;
  public readonly cronExpression: string;
  public readonly handler: ScheduledJobHandler;
  public readonly options: ScheduledJobOptions;

  private _state: JobState = "idle";
  private _lastRun?: number;
  private _nextRun?: number;
  private _runCount = 0;
  private _failCount = 0;
  private _consecutiveFailures = 0;
  private _lastError?: string;
  private readonly _history: JobExecution[] = [];
  private readonly _maxHistory = 100;


  constructor(
    name: string,
    cronExpression: string,
    handler: ScheduledJobHandler,
    options: ScheduledJobOptions = {},
  ) {
    this.name = name;
    this.cronExpression = cronExpression;
    this.handler = handler;
    this.options = {
      overlap: false,
      enabled: true,
      maxFailures: DEFAULT_MAX_FAILURES,
      ...options,
    };

    if (!this.options.enabled) {
      this._state = "disabled";
    }
  }

  get state(): JobState {
    return this._state;
  }

  get lastRun(): number | undefined {
    return this._lastRun;
  }

  get nextRun(): number | undefined {
    return this._nextRun;
  }

  set nextRun(value: number | undefined) {
    this._nextRun = value;
  }

  get runCount(): number {
    return this._runCount;
  }

  get failCount(): number {
    return this._failCount;
  }

  get consecutiveFailures(): number {
    return this._consecutiveFailures;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  get isRunning(): boolean {
    return this._state === "running";
  }

  get history(): readonly JobExecution[] {
    return this._history;
  }

  async execute(): Promise<void> {
    // Overlap prevention
    if (this._state === "running" && !this.options.overlap) {
      return;
    }

    if (this._state === "disabled" || this._state === "paused") {
      return;
    }

    this._state = "running";
    this._lastRun = Date.now();
    this._runCount++;

    const execution: JobExecution = {
      startedAt: Date.now(),
      success: false,
    };

    try {
      if (this.options.maxExecutionTime && this.options.maxExecutionTime > 0) {
        const result = this.handler();
        if (result instanceof Promise) {
          await Promise.race([
            result,
            new Promise<void>((_, reject) =>
              setTimeout(
                () => reject(new Error("Job execution timed out")),
                this.options.maxExecutionTime,
              ),
            ),
          ]);
        }
      } else {
        const result = this.handler();
        if (result instanceof Promise) {
          await result;
        }
      }

      execution.success = true;
      this._consecutiveFailures = 0;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      execution.success = false;
      execution.error = error.message;
      this._failCount++;
      this._consecutiveFailures++;
      this._lastError = error.message;

      // Auto-disable after max failures
      if (
        this.options.maxFailures &&
        this.options.maxFailures > 0 &&
        this._consecutiveFailures >= this.options.maxFailures
      ) {
        this._state = "disabled";
        return;
      }
    } finally {
      execution.finishedAt = Date.now();
      execution.duration = execution.finishedAt - execution.startedAt;

      this._history.push(execution);
      if (this._history.length > this._maxHistory) {
        this._history.shift();
      }

      if (this._state === "running") {
        this._state = "idle";
      }
    }
  }

  pause(): void {
    if (this._state !== "disabled") {
      this._state = "paused";
    }
  }

  resume(): void {
    if (this._state === "paused") {
      this._state = "idle";
    }
  }

  enable(): void {
    this._state = "idle";
    this._consecutiveFailures = 0;
  }

  disable(): void {
    this._state = "disabled";
  }

  getStatus(): JobStatus {
    return {
      name: this.name,
      state: this._state,
      cronExpression: this.cronExpression,
      lastRun: this._lastRun,
      nextRun: this._nextRun,
      runCount: this._runCount,
      failCount: this._failCount,
      consecutiveFailures: this._consecutiveFailures,
      lastError: this._lastError,
    };
  }
}
