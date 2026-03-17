// Queue types

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  timeout?: number;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  jobId?: string;
  repeat?: RepeatOptions;
  lifo?: boolean;
}

export interface BackoffOptions {
  type: "fixed" | "exponential" | "custom";
  delay?: number;
  customFn?: (attemptsMade: number) => number;
}

export interface RepeatOptions {
  cron?: string;
  every?: number;
  limit?: number;
  count?: number;
}

export interface QueueOptions {
  defaultJobOptions?: JobOptions;
  maxConcurrency?: number;
}

export interface WorkerOptions {
  concurrency?: number;
  pollInterval?: number;
  stalledInterval?: number;
  maxStalledCount?: number;
  autorun?: boolean;
}

export interface JobData {
  [key: string]: unknown;
}

export interface JobJson {
  id: string;
  name: string;
  data: JobData;
  opts: JobOptions;
  status: JobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  failedReason?: string;
  returnValue?: unknown;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  delay: number;
  priority: number;
}

export type JobProcessor<T extends JobData = JobData, R = unknown> = (
  job: JobRef<T>,
) => Promise<R> | R;

export interface JobRef<T extends JobData = JobData> {
  id: string;
  name: string;
  data: T;
  opts: JobOptions;
  attempts: number;
  progress(value: number): void;
  update(data: Partial<T>): void;
}

export type QueueEvent =
  | "completed"
  | "failed"
  | "active"
  | "waiting"
  | "delayed"
  | "progress"
  | "drained"
  | "paused"
  | "resumed"
  | "stalled"
  | "error";

export type QueueEventHandler = (data: QueueEventData) => void;

export interface QueueEventData {
  jobId?: string;
  name?: string;
  returnValue?: unknown;
  failedReason?: string;
  progress?: number;
  error?: Error;
}
