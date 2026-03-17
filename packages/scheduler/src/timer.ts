// Timer management - precise setTimeout chains with drift compensation

export class Timer {
  private timerId: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  start(callback: () => void, intervalMs: number): void {
    if (this.running) {
      this.stop();
    }

    this.running = true;
    this.scheduleNext(callback, intervalMs, Date.now());
  }

  private scheduleNext(
    callback: () => void,
    intervalMs: number,
    expectedTime: number,
  ): void {
    if (!this.running) return;

    const now = Date.now();
    const nextExpected = expectedTime + intervalMs;
    // Compensate for drift
    const delay = Math.max(0, nextExpected - now);

    this.timerId = setTimeout(() => {
      if (!this.running) return;
      callback();
      this.scheduleNext(callback, intervalMs, nextExpected);
    }, delay);

    if (this.timerId.unref) {
      this.timerId.unref();
    }
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== undefined) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  static once(callback: () => void, delayMs: number): Timer {
    const timer = new Timer();
    timer.running = true;
    timer.timerId = setTimeout(() => {
      timer.running = false;
      callback();
    }, delayMs);
    if (timer.timerId.unref) {
      timer.timerId.unref();
    }
    return timer;
  }
}
