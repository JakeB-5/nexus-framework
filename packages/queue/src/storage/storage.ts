// Queue storage interface

import type { Job } from "../job.js";
import type { JobData, JobStatus } from "../types.js";

export abstract class QueueStorage {
  abstract addJob<T extends JobData>(job: Job<T>): Promise<void>;
  abstract getJob<T extends JobData>(id: string): Promise<Job<T> | undefined>;
  abstract removeJob(id: string): Promise<boolean>;
  abstract getNextJob<T extends JobData>(
    names?: string[],
  ): Promise<Job<T> | undefined>;
  abstract getJobs<T extends JobData>(
    status?: JobStatus,
    start?: number,
    end?: number,
  ): Promise<Job<T>[]>;
  abstract getJobCounts(): Promise<Record<JobStatus, number>>;
  abstract count(): Promise<number>;
  abstract clean(
    gracePeriod: number,
    status: JobStatus,
  ): Promise<number>;
  abstract promoteDelayed(): Promise<number>;
  abstract clear(): Promise<void>;
}
