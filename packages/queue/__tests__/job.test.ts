import { describe, it, expect } from "vitest";
import { Job } from "../src/job.js";

describe("Job", () => {
  it("should create a job with defaults", () => {
    const job = new Job("email", { to: "user@test.com" });
    expect(job.id).toBeTruthy();
    expect(job.name).toBe("email");
    expect(job.data.to).toBe("user@test.com");
    expect(job.status).toBe("waiting");
    expect(job.progressValue).toBe(0);
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(1);
    expect(job.priority).toBe(0);
    expect(job.delay).toBe(0);
    expect(job.timestamp).toBeTypeOf("number");
  });

  it("should use custom job id", () => {
    const job = new Job("test", {}, { jobId: "custom-123" });
    expect(job.id).toBe("custom-123");
  });

  it("should set delayed status when delay is provided", () => {
    const job = new Job("test", {}, { delay: 5000 });
    expect(job.status).toBe("delayed");
    expect(job.delay).toBe(5000);
  });

  it("should set priority", () => {
    const job = new Job("test", {}, { priority: 5 });
    expect(job.priority).toBe(5);
  });

  it("should track progress", () => {
    const job = new Job("test", {});
    job.progress(50);
    expect(job.progressValue).toBe(50);
  });

  it("should clamp progress between 0 and 100", () => {
    const job = new Job("test", {});
    job.progress(-10);
    expect(job.progressValue).toBe(0);
    job.progress(150);
    expect(job.progressValue).toBe(100);
  });

  it("should update job data", () => {
    const job = new Job("test", { x: 1, y: 2 });
    job.update({ x: 10 });
    expect(job.data.x).toBe(10);
    expect(job.data.y).toBe(2);
  });

  it("should move to active", () => {
    const job = new Job("test", {});
    job.moveToActive();
    expect(job.status).toBe("active");
    expect(job.processedOn).toBeTypeOf("number");
    expect(job.attempts).toBe(1);
  });

  it("should move to completed", () => {
    const job = new Job("test", {});
    job.moveToActive();
    job.moveToCompleted("result");
    expect(job.status).toBe("completed");
    expect(job.returnValue).toBe("result");
    expect(job.finishedOn).toBeTypeOf("number");
    expect(job.progressValue).toBe(100);
  });

  it("should move to failed", () => {
    const job = new Job("test", {});
    job.moveToActive();
    job.moveToFailed(new Error("oops"));
    expect(job.status).toBe("failed");
    expect(job.failedReason).toBe("oops");
    expect(job.finishedOn).toBeTypeOf("number");
    expect(job.stacktrace.length).toBe(1);
  });

  it("should move to delayed", () => {
    const job = new Job("test", {});
    job.moveToDelayed(3000);
    expect(job.status).toBe("delayed");
    expect(job.delay).toBe(3000);
  });

  it("should move to waiting", () => {
    const job = new Job("test", {});
    job.moveToActive();
    job.moveToWaiting();
    expect(job.status).toBe("waiting");
    expect(job.processedOn).toBeUndefined();
  });

  it("should check canRetry", () => {
    const job = new Job("test", {}, { attempts: 3 });
    expect(job.canRetry()).toBe(true);
    job.moveToActive(); // attempts = 1
    expect(job.canRetry()).toBe(true);
    job.moveToWaiting();
    job.moveToActive(); // attempts = 2
    expect(job.canRetry()).toBe(true);
    job.moveToWaiting();
    job.moveToActive(); // attempts = 3
    expect(job.canRetry()).toBe(false);
  });

  it("should check isDelayReady", () => {
    const job = new Job("test", {}, { delay: 0 });
    // Force delayed status with 0 delay for test
    job.status = "delayed";
    expect(job.isDelayReady()).toBe(true);
  });

  it("should discard job", () => {
    const job = new Job("test", {});
    job.discard();
    expect(job.status).toBe("failed");
    expect(job.failedReason).toBe("Job discarded");
  });

  it("should promote delayed job", () => {
    const job = new Job("test", {}, { delay: 5000 });
    expect(job.status).toBe("delayed");
    job.promote();
    expect(job.status).toBe("waiting");
  });

  it("should not promote non-delayed job", () => {
    const job = new Job("test", {});
    expect(job.status).toBe("waiting");
    job.promote();
    expect(job.status).toBe("waiting");
  });

  it("should serialize to JSON", () => {
    const job = new Job("test", { x: 1 }, { priority: 3 });
    const json = job.toJSON();
    expect(json.id).toBe(job.id);
    expect(json.name).toBe("test");
    expect(json.data.x).toBe(1);
    expect(json.priority).toBe(3);
    expect(json.status).toBe("waiting");
  });
});
