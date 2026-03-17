// Queue module integration

import { Queue } from "./queue.js";
import { MemoryStorage } from "./storage/memory-storage.js";
import type { JobData, QueueOptions } from "./types.js";

export interface QueueModuleOptions {
  queues?: Array<{ name: string; options?: QueueOptions }>;
}

export class QueueModule {
  private readonly queues = new Map<string, Queue>();
  private readonly storage = new MemoryStorage();

  constructor(options: QueueModuleOptions = {}) {
    if (options.queues) {
      for (const queueDef of options.queues) {
        this.createQueue(queueDef.name, queueDef.options);
      }
    }
  }

  createQueue<T extends JobData = JobData>(
    name: string,
    options?: QueueOptions,
  ): Queue<T> {
    const queue = new Queue<T>(name, options, this.storage);
    this.queues.set(name, queue as unknown as Queue);
    return queue;
  }

  getQueue<T extends JobData = JobData>(name: string): Queue<T> | undefined {
    return this.queues.get(name) as Queue<T> | undefined;
  }

  getQueues(): Map<string, Queue> {
    return new Map(this.queues);
  }

  async closeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}
