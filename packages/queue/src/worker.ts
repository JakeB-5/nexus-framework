// Worker - processes jobs from the queue

import { ProcessingError } from "./errors.js";
import { calculateBackoff } from "./strategies/retry.js";
import type { QueueStorage } from "./storage/storage.js";
import type {
  JobData,
  JobProcessor,
  JobRef,
  QueueEvent,
  QueueEventData,
  QueueEventHandler,
  WorkerOptions,
} from "./types.js";

export class Worker<T extends JobData = JobData> {
  private readonly storage: QueueStorage;
  private readonly processors = new Map<string, JobProcessor<T>>();
  private readonly concurrency: number;
  private readonly pollInterval: number;
  private activeCount = 0;
  private running = false;
  private paused = false;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new Map<QueueEvent, Set<QueueEventHandler>>();
  private drainResolvers: Array<() => void> = [];
  private readonly names: string[] | undefined;

  constructor(
    storage: QueueStorage,
    options: WorkerOptions = {},
    names?: string[],
  ) {
    this.storage = storage;
    this.concurrency = options.concurrency ?? 1;
    this.pollInterval = options.pollInterval ?? 100;
    this.names = names;

    if (options.autorun !== false) {
      this.start();
    }
  }

  process(name: string, handler: JobProcessor<T>): void {
    this.processors.set(name, handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  pause(): void {
    this.paused = true;
    this.emit("paused", {});
  }

  resume(): void {
    this.paused = false;
    this.emit("resumed", {});
    if (this.running) {
      this.poll();
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getActiveCount(): number {
    return this.activeCount;
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
          // Don't let event handler errors crash the worker
        }
      }
    }
  }

  private poll(): void {
    if (!this.running || this.paused) return;

    if (this.activeCount < this.concurrency) {
      void this.fetchAndProcess();
    }

    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
    if (this.pollTimer.unref) {
      this.pollTimer.unref();
    }
  }

  private async fetchAndProcess(): Promise<void> {
    if (this.activeCount >= this.concurrency) return;

    const filterNames = this.names ?? Array.from(this.processors.keys());
    if (filterNames.length === 0) return;

    const job = await this.storage.getNextJob<T>(filterNames);
    if (!job) {
      // Check if drained
      if (this.activeCount === 0) {
        this.emit("drained", {});
        for (const resolver of this.drainResolvers) {
          resolver();
        }
        this.drainResolvers = [];
      }
      return;
    }

    const processor = this.processors.get(job.name);
    if (!processor) return;

    this.activeCount++;
    job.moveToActive();
    this.emit("active", { jobId: job.id, name: job.name });

    try {
      const jobRef: JobRef<T> = {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        attempts: job.attempts,
        progress: (value: number) => {
          job.progress(value);
          this.emit("progress", { jobId: job.id, progress: value });
        },
        update: (data: Partial<T>) => {
          job.update(data);
        },
      };

      let result: unknown;
      if (job.opts.timeout && job.opts.timeout > 0) {
        result = await Promise.race([
          processor(jobRef),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new ProcessingError("Job timed out")),
              job.opts.timeout,
            ),
          ),
        ]);
      } else {
        result = await processor(jobRef);
      }

      job.moveToCompleted(result);
      this.emit("completed", {
        jobId: job.id,
        name: job.name,
        returnValue: result,
      });

      if (job.opts.removeOnComplete) {
        await this.storage.removeJob(job.id);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      job.moveToFailed(error);

      if (job.canRetry()) {
        const backoffDelay = calculateBackoff(job.opts.backoff, job.attempts);
        if (backoffDelay > 0) {
          job.moveToDelayed(backoffDelay);
        } else {
          job.moveToWaiting();
        }
      } else {
        this.emit("failed", {
          jobId: job.id,
          name: job.name,
          failedReason: error.message,
        });

        if (job.opts.removeOnFail) {
          await this.storage.removeJob(job.id);
        }
      }
    } finally {
      this.activeCount--;
    }

    // Try to fetch another job immediately
    if (this.running && !this.paused && this.activeCount < this.concurrency) {
      void this.fetchAndProcess();
    }
  }

  async drain(): Promise<void> {
    const counts = await this.storage.getJobCounts();
    if (counts.waiting === 0 && counts.active === 0 && counts.delayed === 0) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  async close(): Promise<void> {
    this.stop();
    // Wait for active jobs to finish
    if (this.activeCount > 0) {
      await new Promise<void>((resolve) => {
        const check = (): void => {
          if (this.activeCount === 0) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }
  }
}
