// Queue class - main entry point for job management

import { Job } from "./job.js";
import { Worker } from "./worker.js";
import { MemoryStorage } from "./storage/memory-storage.js";
import type { QueueStorage } from "./storage/storage.js";
import type {
  JobData,
  JobOptions,
  JobProcessor,
  JobStatus,
  QueueEvent,
  QueueEventData,
  QueueEventHandler,
  QueueOptions,
} from "./types.js";

export class Queue<T extends JobData = JobData> {
  public readonly name: string;
  private readonly storage: QueueStorage;
  private readonly defaultJobOptions: JobOptions;
  private worker: Worker<T> | undefined;
  private paused = false;
  private readonly listeners = new Map<QueueEvent, Set<QueueEventHandler>>();

  constructor(
    name: string,
    options: QueueOptions = {},
    storage?: QueueStorage,
  ) {
    this.name = name;
    this.storage = storage ?? new MemoryStorage();
    this.defaultJobOptions = options.defaultJobOptions ?? {};
  }

  async add(name: string, data: T, opts?: JobOptions): Promise<Job<T>> {
    const mergedOpts: JobOptions = { ...this.defaultJobOptions, ...opts };
    const job = new Job<T>(name, data, mergedOpts);
    await this.storage.addJob(job);

    if (job.status === "delayed") {
      this.emit("delayed", { jobId: job.id, name });
    } else {
      this.emit("waiting", { jobId: job.id, name });
    }

    return job;
  }

  async addBulk(
    jobs: Array<{ name: string; data: T; opts?: JobOptions }>,
  ): Promise<Job<T>[]> {
    const results: Job<T>[] = [];
    for (const jobDef of jobs) {
      const job = await this.add(jobDef.name, jobDef.data, jobDef.opts);
      results.push(job);
    }
    return results;
  }

  process(name: string, handler: JobProcessor<T>): void;
  process(
    name: string,
    concurrency: number,
    handler: JobProcessor<T>,
  ): void;
  process(
    name: string,
    concurrencyOrHandler: number | JobProcessor<T>,
    maybeHandler?: JobProcessor<T>,
  ): void {
    let concurrency = 1;
    let handler: JobProcessor<T>;

    if (typeof concurrencyOrHandler === "function") {
      handler = concurrencyOrHandler;
    } else {
      concurrency = concurrencyOrHandler;
      handler = maybeHandler!;
    }

    if (!this.worker) {
      this.worker = new Worker<T>(
        this.storage,
        { concurrency, autorun: !this.paused },
        undefined,
      );
      // Forward worker events
      const events: QueueEvent[] = [
        "completed",
        "failed",
        "active",
        "progress",
        "drained",
        "stalled",
      ];
      for (const event of events) {
        this.worker.on(event, (data) => this.emit(event, data));
      }
    }

    this.worker.process(name, handler);
  }

  async getJob(id: string): Promise<Job<T> | undefined> {
    return this.storage.getJob<T>(id);
  }

  async getJobs(
    status?: JobStatus,
    start?: number,
    end?: number,
  ): Promise<Job<T>[]> {
    return this.storage.getJobs<T>(status, start, end);
  }

  async count(): Promise<number> {
    return this.storage.count();
  }

  async getJobCounts(): Promise<Record<JobStatus, number>> {
    return this.storage.getJobCounts();
  }

  pause(): void {
    this.paused = true;
    if (this.worker) {
      this.worker.pause();
    }
    this.emit("paused", {});
  }

  resume(): void {
    this.paused = false;
    if (this.worker) {
      this.worker.resume();
    }
    this.emit("resumed", {});
  }

  isPaused(): boolean {
    return this.paused;
  }

  async drain(): Promise<void> {
    if (this.worker) {
      return this.worker.drain();
    }
  }

  async clean(gracePeriod: number, status: JobStatus): Promise<number> {
    return this.storage.clean(gracePeriod, status);
  }

  on(event: QueueEvent, handler: QueueEventHandler): void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  off(event: QueueEvent, handler: QueueEventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: QueueEvent, data: QueueEventData): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // Don't let event handler errors affect queue
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  getStorage(): QueueStorage {
    return this.storage;
  }
}
