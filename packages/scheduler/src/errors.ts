// Scheduler error classes

export class SchedulerError extends Error {
  public readonly code: string = "SCHEDULER_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "SchedulerError";
  }
}

export class CronParseError extends SchedulerError {
  public readonly code = "CRON_PARSE_ERROR";
  public readonly expression: string;

  constructor(message: string, expression: string) {
    super(message);
    this.name = "CronParseError";
    this.expression = expression;
  }
}

export class JobExecutionError extends SchedulerError {
  public readonly code = "JOB_EXECUTION_ERROR";
  public readonly jobName: string;
  public readonly originalError?: Error;

  constructor(message: string, jobName: string, originalError?: Error) {
    super(message);
    this.name = "JobExecutionError";
    this.jobName = jobName;
    this.originalError = originalError;
  }
}
