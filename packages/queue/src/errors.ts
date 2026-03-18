// Queue error classes

import { NexusError } from "@nexus/core";

export class QueueError extends NexusError {
  constructor(message: string) {
    super(message, { code: "QUEUE_ERROR" });
    this.name = "QueueError";
  }
}

export class JobError extends QueueError {
  public readonly code: string = "JOB_ERROR";
  public readonly jobId?: string;

  constructor(message: string, jobId?: string) {
    super(message);
    this.name = "JobError";
    this.jobId = jobId;
  }
}

export class ProcessingError extends QueueError {
  public readonly code = "PROCESSING_ERROR";
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "ProcessingError";
    this.originalError = originalError;
  }
}

export class MaxRetriesError extends JobError {
  public readonly code = "MAX_RETRIES";
  public readonly attempts: number;

  constructor(message: string, jobId: string, attempts: number) {
    super(message, jobId);
    this.name = "MaxRetriesError";
    this.attempts = attempts;
  }
}
