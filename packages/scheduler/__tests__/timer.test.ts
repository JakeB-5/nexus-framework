import { describe, it, expect, afterEach } from "vitest";
import { Timer } from "../src/timer.js";

describe("Timer", () => {
  let timer: Timer;

  afterEach(() => {
    timer?.stop();
  });

  it("should fire callback at interval", async () => {
    timer = new Timer();
    let count = 0;

    timer.start(() => {
      count++;
    }, 50);

    await new Promise((r) => setTimeout(r, 180));
    timer.stop();

    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("should stop firing after stop()", async () => {
    timer = new Timer();
    let count = 0;

    timer.start(() => {
      count++;
    }, 50);

    await new Promise((r) => setTimeout(r, 120));
    timer.stop();
    const countAtStop = count;

    await new Promise((r) => setTimeout(r, 100));
    expect(count).toBe(countAtStop);
  });

  it("should report running state", () => {
    timer = new Timer();
    expect(timer.isRunning()).toBe(false);
    timer.start(() => {}, 100);
    expect(timer.isRunning()).toBe(true);
    timer.stop();
    expect(timer.isRunning()).toBe(false);
  });

  it("should restart when start called while running", async () => {
    timer = new Timer();
    let count = 0;

    timer.start(() => {
      count++;
    }, 50);

    await new Promise((r) => setTimeout(r, 80));
    // Restart with new interval
    timer.start(() => {
      count++;
    }, 50);

    await new Promise((r) => setTimeout(r, 80));
    timer.stop();
    // Should have fired a few times
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("should create one-shot timer", async () => {
    let fired = false;
    timer = Timer.once(() => {
      fired = true;
    }, 50);

    expect(timer.isRunning()).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(fired).toBe(true);
    expect(timer.isRunning()).toBe(false);
  });

  it("should cancel one-shot timer", async () => {
    let fired = false;
    timer = Timer.once(() => {
      fired = true;
    }, 100);

    timer.stop();
    await new Promise((r) => setTimeout(r, 150));
    expect(fired).toBe(false);
  });
});
