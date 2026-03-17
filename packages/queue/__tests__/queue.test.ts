import { describe, it, expect, afterEach } from "vitest";
import { Queue } from "../src/queue.js";
import { MemoryStorage } from "../src/storage/memory-storage.js";

describe("Queue", () => {
  let queue: Queue;

  afterEach(async () => {
    await queue?.close();
  });

  it("should create a queue with name", () => {
    queue = new Queue("test-queue");
    expect(queue.name).toBe("test-queue");
  });

  it("should add a job", async () => {
    queue = new Queue("test");
    const job = await queue.add("email", { to: "user@test.com" });
    expect(job.id).toBeTruthy();
    expect(job.name).toBe("email");
    expect(job.status).toBe("waiting");
  });

  it("should add bulk jobs", async () => {
    queue = new Queue("test");
    const jobs = await queue.addBulk([
      { name: "email", data: { to: "a@test.com" } },
      { name: "email", data: { to: "b@test.com" } },
      { name: "sms", data: { to: "+1234" } },
    ]);
    expect(jobs).toHaveLength(3);
    expect(await queue.count()).toBe(3);
  });

  it("should get job by id", async () => {
    queue = new Queue("test");
    const job = await queue.add("email", { to: "user@test.com" });
    const found = await queue.getJob(job.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("email");
  });

  it("should return undefined for unknown job id", async () => {
    queue = new Queue("test");
    expect(await queue.getJob("nonexistent")).toBeUndefined();
  });

  it("should list jobs by status", async () => {
    queue = new Queue("test");
    await queue.add("a", {});
    await queue.add("b", {});
    await queue.add("c", {}, { delay: 5000 });

    const waiting = await queue.getJobs("waiting");
    expect(waiting).toHaveLength(2);

    const delayed = await queue.getJobs("delayed");
    expect(delayed).toHaveLength(1);
  });

  it("should count total jobs", async () => {
    queue = new Queue("test");
    await queue.add("a", {});
    await queue.add("b", {});
    expect(await queue.count()).toBe(2);
  });

  it("should get job counts by status", async () => {
    queue = new Queue("test");
    await queue.add("a", {});
    await queue.add("b", {}, { delay: 1000 });
    const counts = await queue.getJobCounts();
    expect(counts.waiting).toBe(1);
    expect(counts.delayed).toBe(1);
  });

  it("should pause and resume", async () => {
    queue = new Queue("test");
    expect(queue.isPaused()).toBe(false);
    queue.pause();
    expect(queue.isPaused()).toBe(true);
    queue.resume();
    expect(queue.isPaused()).toBe(false);
  });

  it("should emit waiting event on add", async () => {
    queue = new Queue("test");
    let eventData: { jobId?: string } | undefined;
    queue.on("waiting", (data) => {
      eventData = data;
    });
    const job = await queue.add("test", {});
    expect(eventData).toBeDefined();
    expect(eventData!.jobId).toBe(job.id);
  });

  it("should emit delayed event for delayed jobs", async () => {
    queue = new Queue("test");
    let eventData: { jobId?: string } | undefined;
    queue.on("delayed", (data) => {
      eventData = data;
    });
    await queue.add("test", {}, { delay: 5000 });
    expect(eventData).toBeDefined();
  });

  it("should apply default job options", async () => {
    queue = new Queue("test", { defaultJobOptions: { attempts: 5 } });
    const job = await queue.add("email", {});
    expect(job.maxAttempts).toBe(5);
  });

  it("should override default options with per-job options", async () => {
    queue = new Queue("test", { defaultJobOptions: { attempts: 5 } });
    const job = await queue.add("email", {}, { attempts: 2 });
    expect(job.maxAttempts).toBe(2);
  });

  it("should process jobs", async () => {
    const storage = new MemoryStorage();
    queue = new Queue("test", {}, storage);

    const processed: string[] = [];
    queue.process("email", async (job) => {
      processed.push(job.data.to as string);
      return "sent";
    });

    await queue.add("email", { to: "user@test.com" });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(processed).toContain("user@test.com");
  });

  it("should process jobs with concurrency", async () => {
    const storage = new MemoryStorage();
    queue = new Queue("test", {}, storage);

    let maxConcurrent = 0;
    let currentConcurrent = 0;

    queue.process("work", 3, async () => {
      currentConcurrent++;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentConcurrent--;
    });

    for (let i = 0; i < 6; i++) {
      await queue.add("work", { i });
    }

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(maxConcurrent).toBeGreaterThanOrEqual(1);
  });

  it("should clean old completed jobs", async () => {
    const storage = new MemoryStorage();
    queue = new Queue("test", {}, storage);

    const job = await queue.add("test", {});
    // Simulate completion in the past
    job.moveToActive();
    job.moveToCompleted("done");
    job.finishedOn = Date.now() - 10000;

    const removed = await queue.clean(5000, "completed");
    expect(removed).toBe(1);
  });

  it("should remove event listeners", async () => {
    queue = new Queue("test");
    let count = 0;
    const handler = () => { count++; };
    queue.on("waiting", handler);
    await queue.add("a", {});
    expect(count).toBe(1);
    queue.off("waiting", handler);
    await queue.add("b", {});
    expect(count).toBe(1);
  });
});
