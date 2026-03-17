// Job class - represents a unit of work in the queue

import { randomBytes } from "node:crypto";
import type { JobData, JobJson, JobOptions, JobStatus } from "./types.js";

export class Job<T extends JobData = JobData, R = unknown> {
  public readonly id: string;
  public readonly name: string;
  public data: T;
  public readonly opts: JobOptions;
  public status: JobStatus;
  public progressValue: number;
  public attempts: number;
  public readonly maxAttempts: number;
  public failedReason?: string;
  public returnValue?: R;
  public readonly timestamp: number;
  public processedOn?: number;
  public finishedOn?: number;
  public delay: number;
  public readonly priority: number;
  public stacktrace: string[];

  constructor(name: string, data: T, opts: JobOptions = {}) {
    this.id = opts.jobId ?? randomBytes(12).toString("hex");
    this.name = name;
    this.data = data;
    this.opts = opts;
    this.status = opts.delay && opts.delay > 0 ? "delayed" : "waiting";
    this.progressValue = 0;
    this.attempts = 0;
    this.maxAttempts = opts.attempts ?? 1;
    this.timestamp = Date.now();
    this.delay = opts.delay ?? 0;
    this.priority = opts.priority ?? 0;
    this.stacktrace = [];
  }

  progress(value: number): void {
    this.progressValue = Math.max(0, Math.min(100, value));
  }

  update(data: Partial<T>): void {
    this.data = { ...this.data, ...data };
  }

  moveToActive(): void {
    this.status = "active";
    this.processedOn = Date.now();
    this.attempts++;
  }

  moveToCompleted(returnValue?: R): void {
    this.status = "completed";
    this.finishedOn = Date.now();
    this.returnValue = returnValue;
    this.progressValue = 100;
  }

  moveToFailed(error: Error): void {
    this.status = "failed";
    this.finishedOn = Date.now();
    this.failedReason = error.message;
    this.stacktrace.push(error.stack ?? error.message);
  }

  moveToDelayed(delayMs: number): void {
    this.status = "delayed";
    this.finishedOn = undefined;
    this.processedOn = undefined;
    this.delay = delayMs;
  }

  moveToWaiting(): void {
    this.status = "waiting";
    this.finishedOn = undefined;
    this.processedOn = undefined;
  }

  canRetry(): boolean {
    return this.attempts < this.maxAttempts;
  }

  isDelayReady(): boolean {
    if (this.status !== "delayed") {
      return false;
    }
    return Date.now() >= this.timestamp + this.delay;
  }

  discard(): void {
    this.status = "failed";
    this.finishedOn = Date.now();
    this.failedReason = "Job discarded";
  }

  promote(): void {
    if (this.status === "delayed") {
      this.status = "waiting";
      this.processedOn = undefined;
    }
  }

  toJSON(): JobJson {
    return {
      id: this.id,
      name: this.name,
      data: this.data,
      opts: this.opts,
      status: this.status,
      progress: this.progressValue,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      failedReason: this.failedReason,
      returnValue: this.returnValue,
      timestamp: this.timestamp,
      processedOn: this.processedOn,
      finishedOn: this.finishedOn,
      delay: this.delay,
      priority: this.priority,
    };
  }
}
