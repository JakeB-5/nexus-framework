// Scheduler types

export interface CronExpression {
  second?: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  raw: string;
}

export type JobState = "idle" | "running" | "paused" | "disabled";

export interface SchedulerOptions {
  timezone?: string;
  maxConcurrency?: number;
  autoStart?: boolean;
}

export interface ScheduledJobOptions {
  timezone?: string;
  runOnInit?: boolean;
  overlap?: boolean;
  maxExecutionTime?: number;
  maxFailures?: number;
  enabled?: boolean;
}

export interface JobExecution {
  startedAt: number;
  finishedAt?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

export type ScheduledJobHandler = () => Promise<void> | void;

export interface JobStatus {
  name: string;
  state: JobState;
  cronExpression: string;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  failCount: number;
  consecutiveFailures: number;
  lastError?: string;
}
