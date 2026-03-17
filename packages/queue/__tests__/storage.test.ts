import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../src/storage/memory-storage.js";
import { Job } from "../src/job.js";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("should add and get a job", async () => {
    const job = new Job("test", { x: 1 });
    await storage.addJob(job);
    const found = await storage.getJob(job.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("test");
  });

  it("should return undefined for unknown id", async () => {
    expect(await storage.getJob("nope")).toBeUndefined();
  });

  it("should remove a job", async () => {
    const job = new Job("test", {});
    await storage.addJob(job);
    expect(await storage.removeJob(job.id)).toBe(true);
    expect(await storage.getJob(job.id)).toBeUndefined();
  });

  it("should return false when removing unknown job", async () => {
    expect(await storage.removeJob("nope")).toBe(false);
  });

  it("should get next job by priority (lower number = higher priority)", async () => {
    const low = new Job("low", {}, { priority: 10 });
    const high = new Job("high", {}, { priority: 1 });
    const mid = new Job("mid", {}, { priority: 5 });
    await storage.addJob(low);
    await storage.addJob(high);
    await storage.addJob(mid);

    const next = await storage.getNextJob();
    expect(next!.name).toBe("high");
  });

  it("should get next job FIFO for same priority", async () => {
    const first = new Job("first", {}, { priority: 0 });
    // Ensure second has later timestamp
    await new Promise((r) => setTimeout(r, 5));
    const second = new Job("second", {}, { priority: 0 });
    await storage.addJob(first);
    await storage.addJob(second);

    const next = await storage.getNextJob();
    expect(next!.name).toBe("first");
  });

  it("should filter by names", async () => {
    const email = new Job("email", {});
    const sms = new Job("sms", {});
    await storage.addJob(email);
    await storage.addJob(sms);

    const next = await storage.getNextJob(["sms"]);
    expect(next!.name).toBe("sms");
  });

  it("should return undefined when no waiting jobs", async () => {
    const job = new Job("test", {});
    job.status = "active";
    await storage.addJob(job);
    expect(await storage.getNextJob()).toBeUndefined();
  });

  it("should get jobs by status", async () => {
    const j1 = new Job("a", {});
    const j2 = new Job("b", {});
    j2.moveToActive();
    j2.moveToCompleted("ok");
    await storage.addJob(j1);
    await storage.addJob(j2);

    const waiting = await storage.getJobs("waiting");
    expect(waiting).toHaveLength(1);
    const completed = await storage.getJobs("completed");
    expect(completed).toHaveLength(1);
  });

  it("should get jobs with pagination", async () => {
    for (let i = 0; i < 10; i++) {
      await storage.addJob(new Job(`job-${i}`, {}));
    }
    const page = await storage.getJobs(undefined, 2, 5);
    expect(page).toHaveLength(3);
  });

  it("should get job counts", async () => {
    await storage.addJob(new Job("a", {}));
    await storage.addJob(new Job("b", {}));
    const delayed = new Job("c", {}, { delay: 5000 });
    await storage.addJob(delayed);

    const counts = await storage.getJobCounts();
    expect(counts.waiting).toBe(2);
    expect(counts.delayed).toBe(1);
  });

  it("should count total jobs", async () => {
    await storage.addJob(new Job("a", {}));
    await storage.addJob(new Job("b", {}));
    expect(await storage.count()).toBe(2);
  });

  it("should clean old completed jobs", async () => {
    const job = new Job("test", {});
    job.moveToActive();
    job.moveToCompleted("ok");
    job.finishedOn = Date.now() - 10000;
    await storage.addJob(job);

    const recent = new Job("recent", {});
    recent.moveToActive();
    recent.moveToCompleted("ok");
    await storage.addJob(recent);

    const removed = await storage.clean(5000, "completed");
    expect(removed).toBe(1);
    expect(await storage.count()).toBe(1);
  });

  it("should promote delayed jobs", async () => {
    const job = new Job("test", {}, { delay: 0 });
    // Force delayed with 0 delay (ready immediately)
    await storage.addJob(job);
    // Job was created with delay: 0, so it's actually waiting.
    // Create a truly delayed job with past timestamp
    const delayed = new Job("delayed", {}, { delay: 1 });
    await storage.addJob(delayed);

    // Wait for delay to pass
    await new Promise((r) => setTimeout(r, 5));
    const promoted = await storage.promoteDelayed();
    expect(promoted).toBe(1);
  });

  it("should clear all jobs", async () => {
    await storage.addJob(new Job("a", {}));
    await storage.addJob(new Job("b", {}));
    await storage.clear();
    expect(await storage.count()).toBe(0);
  });
});
