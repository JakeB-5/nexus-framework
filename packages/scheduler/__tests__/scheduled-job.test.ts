import { describe, it, expect } from "vitest";
import { ScheduledJob } from "../src/scheduled-job.js";

describe("ScheduledJob", () => {
  it("should create a job with defaults", () => {
    const job = new ScheduledJob("test", "* * * * *", () => {});
    expect(job.name).toBe("test");
    expect(job.cronExpression).toBe("* * * * *");
    expect(job.state).toBe("idle");
    expect(job.runCount).toBe(0);
    expect(job.failCount).toBe(0);
  });

  it("should start disabled if option set", () => {
    const job = new ScheduledJob("test", "* * * * *", () => {}, {
      enabled: false,
    });
    expect(job.state).toBe("disabled");
  });

  it("should execute handler", async () => {
    let executed = false;
    const job = new ScheduledJob("test", "* * * * *", () => {
      executed = true;
    });

    await job.execute();
    expect(executed).toBe(true);
    expect(job.runCount).toBe(1);
    expect(job.state).toBe("idle");
    expect(job.lastRun).toBeTypeOf("number");
  });

  it("should execute async handler", async () => {
    let executed = false;
    const job = new ScheduledJob("test", "* * * * *", async () => {
      await new Promise((r) => setTimeout(r, 10));
      executed = true;
    });

    await job.execute();
    expect(executed).toBe(true);
  });

  it("should handle failed execution", async () => {
    const job = new ScheduledJob("test", "* * * * *", () => {
      throw new Error("boom");
    });

    await job.execute();
    expect(job.failCount).toBe(1);
    expect(job.consecutiveFailures).toBe(1);
    expect(job.lastError).toBe("boom");
    expect(job.state).toBe("idle");
  });

  it("should reset consecutive failures on success", async () => {
    let shouldFail = true;
    const job = new ScheduledJob("test", "* * * * *", () => {
      if (shouldFail) throw new Error("fail");
    });

    await job.execute();
    expect(job.consecutiveFailures).toBe(1);

    shouldFail = false;
    await job.execute();
    expect(job.consecutiveFailures).toBe(0);
  });

  it("should auto-disable after max failures", async () => {
    const job = new ScheduledJob(
      "test",
      "* * * * *",
      () => {
        throw new Error("fail");
      },
      { maxFailures: 3 },
    );

    await job.execute();
    await job.execute();
    expect(job.state).toBe("idle");

    await job.execute(); // 3rd failure
    expect(job.state).toBe("disabled");
  });

  it("should prevent overlap by default", async () => {
    let concurrentRuns = 0;
    let maxConcurrent = 0;

    const job = new ScheduledJob("test", "* * * * *", async () => {
      concurrentRuns++;
      if (concurrentRuns > maxConcurrent) maxConcurrent = concurrentRuns;
      await new Promise((r) => setTimeout(r, 50));
      concurrentRuns--;
    });

    // Start two executions
    const p1 = job.execute();
    const p2 = job.execute(); // should be skipped (overlap prevention)
    await Promise.all([p1, p2]);

    expect(maxConcurrent).toBe(1);
  });

  it("should allow overlap if configured", async () => {
    let concurrentRuns = 0;
    let maxConcurrent = 0;

    const job = new ScheduledJob(
      "test",
      "* * * * *",
      async () => {
        concurrentRuns++;
        if (concurrentRuns > maxConcurrent) maxConcurrent = concurrentRuns;
        await new Promise((r) => setTimeout(r, 50));
        concurrentRuns--;
      },
      { overlap: true },
    );

    const p1 = job.execute();
    const p2 = job.execute();
    await Promise.all([p1, p2]);

    expect(maxConcurrent).toBe(2);
  });

  it("should not execute when paused", async () => {
    let executed = false;
    const job = new ScheduledJob("test", "* * * * *", () => {
      executed = true;
    });

    job.pause();
    await job.execute();
    expect(executed).toBe(false);
    expect(job.state).toBe("paused");
  });

  it("should not execute when disabled", async () => {
    let executed = false;
    const job = new ScheduledJob("test", "* * * * *", () => {
      executed = true;
    });

    job.disable();
    await job.execute();
    expect(executed).toBe(false);
  });

  it("should pause and resume", () => {
    const job = new ScheduledJob("test", "* * * * *", () => {});
    job.pause();
    expect(job.state).toBe("paused");
    job.resume();
    expect(job.state).toBe("idle");
  });

  it("should enable and disable", () => {
    const job = new ScheduledJob("test", "* * * * *", () => {});
    job.disable();
    expect(job.state).toBe("disabled");
    job.enable();
    expect(job.state).toBe("idle");
  });

  it("should track execution history", async () => {
    const job = new ScheduledJob("test", "* * * * *", () => {});
    await job.execute();
    await job.execute();

    expect(job.history).toHaveLength(2);
    expect(job.history[0].success).toBe(true);
    expect(job.history[0].duration).toBeTypeOf("number");
  });

  it("should get job status", async () => {
    const job = new ScheduledJob("test", "*/5 * * * *", () => {});
    await job.execute();

    const status = job.getStatus();
    expect(status.name).toBe("test");
    expect(status.state).toBe("idle");
    expect(status.cronExpression).toBe("*/5 * * * *");
    expect(status.runCount).toBe(1);
    expect(status.failCount).toBe(0);
    expect(status.lastRun).toBeTypeOf("number");
  });

  it("should handle execution timeout", async () => {
    const job = new ScheduledJob(
      "test",
      "* * * * *",
      async () => {
        await new Promise((r) => setTimeout(r, 200));
      },
      { maxExecutionTime: 50 },
    );

    await job.execute();
    expect(job.failCount).toBe(1);
    expect(job.lastError).toContain("timed out");
  });

  it("should set and get nextRun", () => {
    const job = new ScheduledJob("test", "* * * * *", () => {});
    job.nextRun = 12345;
    expect(job.nextRun).toBe(12345);
  });

  it("should report isRunning", async () => {
    let resolve: () => void;
    const barrier = new Promise<void>((r) => { resolve = r; });

    const job = new ScheduledJob("test", "* * * * *", async () => {
      await barrier;
    }, { overlap: true });

    const p = job.execute();
    expect(job.isRunning).toBe(true);
    resolve!();
    await p;
    expect(job.isRunning).toBe(false);
  });
});
