// Job scheduling - delayed, repeatable, cron-based jobs

import type { Queue } from "./queue.js";
import type { JobData, JobOptions, RepeatOptions } from "./types.js";

export interface ScheduledJobDef<T extends JobData = JobData> {
  name: string;
  data: T;
  opts: JobOptions;
  repeat: RepeatOptions;
  timer?: ReturnType<typeof setInterval>;
  nextRun?: number;
}

export class QueueScheduler<T extends JobData = JobData> {
  private readonly queue: Queue<T>;
  private readonly scheduled = new Map<string, ScheduledJobDef<T>>();
  private running = false;

  constructor(queue: Queue<T>) {
    this.queue = queue;
  }

  every(
    interval: number,
    name: string,
    data: T,
    opts: JobOptions = {},
  ): string {
    const key = `repeat:${name}:${interval}`;

    const def: ScheduledJobDef<T> = {
      name,
      data,
      opts,
      repeat: { every: interval },
    };

    this.scheduled.set(key, def);

    if (this.running) {
      this.startRepeatable(key, def);
    }

    return key;
  }

  removeRepeatable(key: string): boolean {
    const def = this.scheduled.get(key);
    if (!def) {
      return false;
    }

    if (def.timer) {
      clearInterval(def.timer);
    }

    return this.scheduled.delete(key);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const [key, def] of this.scheduled) {
      this.startRepeatable(key, def);
    }
  }

  stop(): void {
    this.running = false;
    for (const def of this.scheduled.values()) {
      if (def.timer) {
        clearInterval(def.timer);
        def.timer = undefined;
      }
    }
  }

  getScheduled(): Map<string, ScheduledJobDef<T>> {
    return new Map(this.scheduled);
  }

  private startRepeatable(key: string, def: ScheduledJobDef<T>): void {
    if (def.timer) {
      clearInterval(def.timer);
    }

    if (def.repeat.every) {
      const interval = def.repeat.every;
      let count = 0;

      def.timer = setInterval(() => {
        if (def.repeat.limit && count >= def.repeat.limit) {
          this.removeRepeatable(key);
          return;
        }
        count++;
        void this.queue.add(def.name, def.data, def.opts);
      }, interval);

      if (def.timer.unref) {
        def.timer.unref();
      }
    }
  }
}
