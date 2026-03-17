import { describe, it, expect, afterEach } from "vitest";
import { Scheduler } from "../src/scheduler.js";
import { SchedulerError } from "../src/errors.js";

describe("Scheduler", () => {
  let scheduler: Scheduler;

  afterEach(() => {
    scheduler?.destroy();
  });

  it("should create a scheduler", () => {
    scheduler = new Scheduler();
    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.jobCount()).toBe(0);
  });

  it("should schedule a job", () => {
    scheduler = new Scheduler();
    const job = scheduler.schedule("test", "* * * * *", () => {});
    expect(job.name).toBe("test");
    expect(scheduler.jobCount()).toBe(1);
  });

  it("should throw on duplicate job name", () => {
    scheduler = new Scheduler();
    scheduler.schedule("test", "* * * * *", () => {});
    expect(() =>
      scheduler.schedule("test", "* * * * *", () => {}),
    ).toThrow(SchedulerError);
  });

  it("should unschedule a job", () => {
    scheduler = new Scheduler();
    scheduler.schedule("test", "* * * * *", () => {});
    expect(scheduler.unschedule("test")).toBe(true);
    expect(scheduler.jobCount()).toBe(0);
  });

  it("should return false for unscheduling unknown job", () => {
    scheduler = new Scheduler();
    expect(scheduler.unschedule("nope")).toBe(false);
  });

  it("should start and stop", () => {
    scheduler = new Scheduler();
    scheduler.schedule("test", "* * * * *", () => {});
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it("should autoStart if configured", () => {
    scheduler = new Scheduler({ autoStart: true });
    expect(scheduler.isRunning()).toBe(true);
  });

  it("should get all job statuses", () => {
    scheduler = new Scheduler();
    scheduler.schedule("job1", "*/5 * * * *", () => {});
    scheduler.schedule("job2", "0 * * * *", () => {});

    const jobs = scheduler.getJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.name).sort()).toEqual(["job1", "job2"]);
  });

  it("should get a specific job", () => {
    scheduler = new Scheduler();
    scheduler.schedule("test", "* * * * *", () => {});
    const job = scheduler.getJob("test");
    expect(job).toBeDefined();
    expect(job!.name).toBe("test");
  });

  it("should return undefined for unknown job", () => {
    scheduler = new Scheduler();
    expect(scheduler.getJob("nope")).toBeUndefined();
  });

  it("should get next run for a job", () => {
    scheduler = new Scheduler();
    scheduler.schedule("test", "0 12 * * *", () => {});
    const nextRun = scheduler.getNextRun("test");
    expect(nextRun).toBeInstanceOf(Date);
    expect(nextRun!.getHours()).toBe(12);
    expect(nextRun!.getMinutes()).toBe(0);
  });

  it("should return undefined for next run of unknown job", () => {
    scheduler = new Scheduler();
    expect(scheduler.getNextRun("nope")).toBeUndefined();
  });

  it("should run a job immediately", async () => {
    scheduler = new Scheduler();
    let executed = false;
    scheduler.schedule("test", "0 0 1 1 *", () => {
      executed = true;
    });

    await scheduler.runNow("test");
    expect(executed).toBe(true);
  });

  it("should throw when running unknown job", async () => {
    scheduler = new Scheduler();
    await expect(scheduler.runNow("nope")).rejects.toThrow(SchedulerError);
  });

  it("should pause and resume a job", () => {
    scheduler = new Scheduler();
    scheduler.schedule("test", "* * * * *", () => {});

    scheduler.pauseJob("test");
    expect(scheduler.getJob("test")!.state).toBe("paused");

    scheduler.resumeJob("test");
    expect(scheduler.getJob("test")!.state).toBe("idle");
  });

  it("should throw when pausing unknown job", () => {
    scheduler = new Scheduler();
    expect(() => scheduler.pauseJob("nope")).toThrow(SchedulerError);
  });

  it("should throw when resuming unknown job", () => {
    scheduler = new Scheduler();
    expect(() => scheduler.resumeJob("nope")).toThrow(SchedulerError);
  });

  it("should execute job on schedule", async () => {
    scheduler = new Scheduler();
    let count = 0;

    // Use every-second cron with 6 fields
    scheduler.schedule("fast", "* * * * * *", () => {
      count++;
    });

    scheduler.start();
    await new Promise((r) => setTimeout(r, 2500));
    scheduler.stop();

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("should destroy and clean up", () => {
    scheduler = new Scheduler();
    scheduler.schedule("a", "* * * * *", () => {});
    scheduler.schedule("b", "* * * * *", () => {});
    scheduler.start();
    scheduler.destroy();

    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.jobCount()).toBe(0);
  });

  it("should run job on init when configured", async () => {
    scheduler = new Scheduler();
    let executed = false;

    scheduler.start();
    scheduler.schedule(
      "init-test",
      "0 0 1 1 *", // Far future cron
      () => {
        executed = true;
      },
      { runOnInit: true },
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(executed).toBe(true);
  });
});
