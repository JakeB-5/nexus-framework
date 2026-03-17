// @nexus/events - Module integration

import type { DynamicModule } from "@nexus/core";
import { EventBus } from "./event-bus.js";
import type { EventModuleOptions } from "./types.js";

/**
 * Event module class.
 */
export class EventModule {
  /**
   * Create a root event module with a shared EventBus.
   */
  static forRoot(options: EventModuleOptions = {}): DynamicModule {
    const bus = new EventBus(options.busOptions);

    return {
      module: EventModule,
      providers: [
        {
          provide: "EventBus",
          useValue: bus,
        },
        {
          provide: "EVENT_OPTIONS",
          useValue: options,
        },
      ],
      exports: ["EventBus"],
      global: options.global ?? true,
    };
  }
}
