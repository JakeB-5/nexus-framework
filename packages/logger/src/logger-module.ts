// @nexus/logger - Module integration

import type { DynamicModule } from "@nexus/core";
import { NexusLogger } from "./logger-service.js";
import type { LoggerModuleOptions } from "./types.js";
import { JsonFormatter } from "./formatter.js";
import { LogLevel } from "./types.js";

/**
 * Logger module class.
 */
export class LoggerModule {
  /**
   * Create a root logger module.
   */
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    const logger = new NexusLogger({
      level: options.level ?? LogLevel.Info,
      transports: options.transports ?? [],
      formatter: options.formatter ?? new JsonFormatter(),
    });

    return {
      module: LoggerModule,
      providers: [
        {
          provide: "NexusLogger",
          useValue: logger,
        },
        {
          provide: "LOGGER_OPTIONS",
          useValue: options,
        },
      ],
      exports: ["NexusLogger"],
      global: options.global ?? true,
    };
  }
}
