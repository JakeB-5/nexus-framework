import { describe, it, expect, afterEach } from "vitest";
import { Worker } from "../src/worker.js";
import { Job } from "../src/job.js";
import { MemoryStorage } from "../src/storage/memory-storage.js";

describe("Worker", () => {
  let worker: Worker;
  let storage: MemoryStorage;

  afterEach(async () => {
    worker?.stop();
  });

  it("should process a job", async () => {
    storage = new MemoryStorage();
    const job = new Job("email", { to: "user@test.com" });
    await storage.addJob(job);

    let processed = false;
    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.process("email", async (j) => {
      processed = true;
      expect(j.data.to).toBe("user@test.com");
      return "sent";
    });
    worker.start();

    await new Promise((r) => setTimeout(r, 200));
    expect(processed).toBe(true);
    expect(job.status).toBe("completed");
  });

  it("should handle job failure", async () => {
    storage = new MemoryStorage();
    const job = new Job("fail", {});
    await storage.addJob(job);

    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.process("fail", async () => {
      throw new Error("boom");
    });
    worker.start();

    await new Promise((r) => setTimeout(r, 200));
    expect(job.status).toBe("failed");
    expect(job.failedReason).toBe("boom");
  });

  it("should retry failed jobs", async () => {
    storage = new MemoryStorage();
    const job = new Job("retry-test", {}, { attempts: 3 });
    await storage.addJob(job);

    let callCount = 0;
    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.process("retry-test", async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("not yet");
      }
      return "ok";
    });
    worker.start();

    await new Promise((r) => setTimeout(r, 600));
    expect(callCount).toBe(3);
    expect(job.status).toBe("completed");
  });

  it("should emit events", async () => {
    storage = new MemoryStorage();
    const job = new Job("event-test", {});
    await storage.addJob(job);

    const events: string[] = [];
    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.on("active", () => events.push("active"));
    worker.on("completed", () => events.push("completed"));
    worker.process("event-test", async () => "done");
    worker.start();

    await new Promise((r) => setTimeout(r, 200));
    expect(events).toContain("active");
    expect(events).toContain("completed");
  });

  it("should emit progress events", async () => {
    storage = new MemoryStorage();
    const job = new Job("progress-test", {});
    await storage.addJob(job);

    let progressValue = 0;
    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.on("progress", (data) => {
      progressValue = data.progress ?? 0;
    });
    worker.process("progress-test", async (j) => {
      j.progress(50);
    });
    worker.start();

    await new Promise((r) => setTimeout(r, 200));
    expect(progressValue).toBe(50);
  });

  it("should pause and resume", async () => {
    storage = new MemoryStorage();
    worker = new Worker(storage, { pollInterval: 50, autorun: false });

    expect(worker.isPaused()).toBe(false);
    worker.pause();
    expect(worker.isPaused()).toBe(true);
    worker.resume();
    expect(worker.isPaused()).toBe(false);
  });

  it("should start and stop", () => {
    storage = new MemoryStorage();
    worker = new Worker(storage, { autorun: false });
    expect(worker.isRunning()).toBe(false);
    worker.start();
    expect(worker.isRunning()).toBe(true);
    worker.stop();
    expect(worker.isRunning()).toBe(false);
  });

  it("should handle job timeout", async () => {
    storage = new MemoryStorage();
    const job = new Job("slow", {}, { timeout: 50 });
    await storage.addJob(job);

    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.process("slow", async () => {
      await new Promise((r) => setTimeout(r, 200));
      return "done";
    });
    worker.start();

    await new Promise((r) => setTimeout(r, 400));
    expect(job.status).toBe("failed");
    expect(job.failedReason).toContain("timed out");
  });

  it("should remove on complete when option set", async () => {
    storage = new MemoryStorage();
    const job = new Job("rm-test", {}, { removeOnComplete: true });
    await storage.addJob(job);

    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.process("rm-test", async () => "ok");
    worker.start();

    await new Promise((r) => setTimeout(r, 200));
    expect(await storage.getJob(job.id)).toBeUndefined();
  });

  it("should remove event listeners with off", async () => {
    storage = new MemoryStorage();
    worker = new Worker(storage, { autorun: false });
    let count = 0;
    const handler = () => { count++; };
    worker.on("active", handler);
    worker.off("active", handler);

    const job = new Job("test", {});
    await storage.addJob(job);
    worker.process("test", async () => "ok");
    worker.start();

    await new Promise((r) => setTimeout(r, 200));
    expect(count).toBe(0);
  });

  it("should close gracefully", async () => {
    storage = new MemoryStorage();
    worker = new Worker(storage, { pollInterval: 50, autorun: false });
    worker.process("test", async () => "ok");
    worker.start();

    await worker.close();
    expect(worker.isRunning()).toBe(false);
  });
});
