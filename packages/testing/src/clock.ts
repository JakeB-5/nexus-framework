// @nexus/testing - Time mocking

/**
 * Fake timer controller
 */
export class FakeClock {
  private currentTime: number;
  private timers: Array<{ id: number; callback: () => void; triggerAt: number; interval?: number }> = [];
  private nextTimerId = 1;
  private originalDateNow: typeof Date.now;
  private originalSetTimeout: typeof globalThis.setTimeout;
  private originalClearTimeout: typeof globalThis.clearTimeout;
  private originalSetInterval: typeof globalThis.setInterval;
  private originalClearInterval: typeof globalThis.clearInterval;
  private installed = false;

  constructor(startTime?: Date | number) {
    this.currentTime = startTime instanceof Date ? startTime.getTime() : (startTime ?? Date.now());
    this.originalDateNow = Date.now;
    this.originalSetTimeout = globalThis.setTimeout;
    this.originalClearTimeout = globalThis.clearTimeout;
    this.originalSetInterval = globalThis.setInterval;
    this.originalClearInterval = globalThis.clearInterval;
  }

  /**
   * Install fake timers (replaces Date.now, setTimeout, setInterval)
   */
  install(): this {
    if (this.installed) return this;
    this.installed = true;

    const self = this;

    Date.now = () => self.currentTime;

    // @ts-expect-error - overriding global setTimeout with simplified version
    globalThis.setTimeout = (callback: () => void, delay?: number): number => {
      const id = self.nextTimerId++;
      self.timers.push({
        id,
        callback,
        triggerAt: self.currentTime + (delay ?? 0),
      });
      return id;
    };

    // @ts-expect-error - overriding global clearTimeout
    globalThis.clearTimeout = (id?: number): void => {
      self.timers = self.timers.filter((t) => t.id !== id);
    };

    // @ts-expect-error - overriding global setInterval
    globalThis.setInterval = (callback: () => void, delay?: number): number => {
      const id = self.nextTimerId++;
      self.timers.push({
        id,
        callback,
        triggerAt: self.currentTime + (delay ?? 0),
        interval: delay ?? 0,
      });
      return id;
    };

    // @ts-expect-error - overriding global clearInterval
    globalThis.clearInterval = (id?: number): void => {
      self.timers = self.timers.filter((t) => t.id !== id);
    };

    return this;
  }

  /**
   * Advance time by specified milliseconds
   */
  tick(ms: number): void {
    const targetTime = this.currentTime + ms;

    while (true) {
      // Find next timer to fire
      const nextTimer = this.timers
        .filter((t) => t.triggerAt <= targetTime)
        .sort((a, b) => a.triggerAt - b.triggerAt)[0];

      if (!nextTimer) {
        this.currentTime = targetTime;
        break;
      }

      this.currentTime = nextTimer.triggerAt;
      nextTimer.callback();

      if (nextTimer.interval !== undefined) {
        // Reschedule interval
        nextTimer.triggerAt = this.currentTime + nextTimer.interval;
      } else {
        // Remove one-shot timer
        this.timers = this.timers.filter((t) => t.id !== nextTimer.id);
      }
    }
  }

  /**
   * Set the current time
   */
  setTime(date: Date | number): void {
    this.currentTime = date instanceof Date ? date.getTime() : date;
  }

  /**
   * Get the current fake time
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Get pending timer count
   */
  get pendingTimers(): number {
    return this.timers.length;
  }

  /**
   * Clear all pending timers
   */
  clearAllTimers(): void {
    this.timers = [];
  }

  /**
   * Restore real timers
   */
  restore(): void {
    if (!this.installed) return;
    this.installed = false;

    Date.now = this.originalDateNow;
    globalThis.setTimeout = this.originalSetTimeout;
    globalThis.clearTimeout = this.originalClearTimeout;
    globalThis.setInterval = this.originalSetInterval;
    globalThis.clearInterval = this.originalClearInterval;

    this.timers = [];
  }
}

/**
 * Create and install fake timers
 */
export function useFakeTimers(startTime?: Date | number): FakeClock {
  return new FakeClock(startTime).install();
}
