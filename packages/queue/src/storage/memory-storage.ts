// In-memory job storage with priority queue

import { Job } from "../job.js";
import type { JobData, JobStatus } from "../types.js";
import { QueueStorage } from "./storage.js";

export class MemoryStorage extends QueueStorage {
  private readonly jobs = new Map<string, Job>();

  async addJob<T extends JobData>(job: Job<T>): Promise<void> {
    this.jobs.set(job.id, job as Job);
  }

  async getJob<T extends JobData>(id: string): Promise<Job<T> | undefined> {
    return this.jobs.get(id) as Job<T> | undefined;
  }

  async removeJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async getNextJob<T extends JobData>(
    names?: string[],
  ): Promise<Job<T> | undefined> {
    // First promote any delayed jobs that are ready
    await this.promoteDelayed();

    let best: Job | undefined;
    let bestPriority = Infinity;
    let bestTimestamp = Infinity;

    for (const job of this.jobs.values()) {
      if (job.status !== "waiting") {
        continue;
      }
      if (names && names.length > 0 && !names.includes(job.name)) {
        continue;
      }

      // Lower priority number = higher priority. Equal priority = FIFO by timestamp.
      if (
        job.priority < bestPriority ||
        (job.priority === bestPriority && job.timestamp < bestTimestamp)
      ) {
        best = job;
        bestPriority = job.priority;
        bestTimestamp = job.timestamp;
      }
    }

    // Check for LIFO jobs
    if (!best) {
      return undefined;
    }

    if (best.opts.lifo) {
      // For LIFO, find the latest job with same name and priority
      let latest = best;
      for (const job of this.jobs.values()) {
        if (
          job.status === "waiting" &&
          job.name === best.name &&
          job.priority === best.priority &&
          job.timestamp > latest.timestamp
        ) {
          latest = job;
        }
      }
      return latest as Job<T>;
    }

    return best as Job<T>;
  }

  async getJobs<T extends JobData>(
    status?: JobStatus,
    start = 0,
    end?: number,
  ): Promise<Job<T>[]> {
    let jobs = Array.from(this.jobs.values());

    if (status) {
      jobs = jobs.filter((j) => j.status === status);
    }

    // Sort by priority (asc) then timestamp (asc)
    jobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });

    const endIdx = end ?? jobs.length;
    return jobs.slice(start, endIdx) as Job<T>[];
  }

  async getJobCounts(): Promise<Record<JobStatus, number>> {
    const counts: Record<JobStatus, number> = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };

    for (const job of this.jobs.values()) {
      counts[job.status]++;
    }

    return counts;
  }

  async count(): Promise<number> {
    return this.jobs.size;
  }

  async clean(gracePeriod: number, status: JobStatus): Promise<number> {
    const cutoff = Date.now() - gracePeriod;
    let removed = 0;

    for (const [id, job] of this.jobs) {
      if (job.status === status && job.finishedOn && job.finishedOn < cutoff) {
        this.jobs.delete(id);
        removed++;
      }
    }

    return removed;
  }

  async promoteDelayed(): Promise<number> {
    let promoted = 0;
    const now = Date.now();

    for (const job of this.jobs.values()) {
      if (job.status === "delayed" && now >= job.timestamp + job.delay) {
        job.moveToWaiting();
        promoted++;
      }
    }

    return promoted;
  }

  async clear(): Promise<void> {
    this.jobs.clear();
  }
}
