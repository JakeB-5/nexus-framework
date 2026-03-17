// @nexus/config - Module integration

import type { DynamicModule } from "@nexus/core";
import { ConfigService } from "./config-service.js";
import type { ConfigModuleOptions, ConfigFeatureOptions } from "./types.js";
import { EnvLoader } from "./loaders/env-loader.js";

/**
 * Config module class used as the module token.
 */
export class ConfigModule {
  /**
   * Create a root configuration module.
   * Loads config from defaults, files, and environment variables.
   */
  static forRoot(options: ConfigModuleOptions = {}): DynamicModule {
    const loaders = [...(options.loaders ?? [])];

    // Add env loader if prefix is specified
    if (options.envPrefix) {
      loaders.push(
        new EnvLoader({
          prefix: options.envPrefix,
          envFilePath: options.envFilePath,
        }),
      );
    }

    const configService = new ConfigService({ schema: options.schema });

    // Create a factory that loads config asynchronously
    const configFactory = async (): Promise<ConfigService> => {
      await configService.loadFrom(options.defaults ?? {}, loaders);
      return configService;
    };

    return {
      module: ConfigModule,
      providers: [
        {
          provide: "ConfigService",
          useFactory: configFactory,
        },
        {
          provide: "CONFIG_OPTIONS",
          useValue: options,
        },
      ],
      exports: ["ConfigService"],
      global: options.global ?? false,
    };
  }

  /**
   * Create a feature configuration module for scoped config.
   */
  static forFeature(options: ConfigFeatureOptions): DynamicModule {
    const featureToken = `CONFIG_${options.namespace.toUpperCase()}`;

    return {
      module: ConfigModule,
      providers: [
        {
          provide: featureToken,
          useFactory: (configService: unknown) => {
            const svc = configService as ConfigService;
            const namespaceConfig = svc.get<Record<string, unknown>>(
              options.namespace,
              {},
            );
            return namespaceConfig;
          },
          inject: ["ConfigService"],
        },
        {
          provide: `CONFIG_SCHEMA_${options.namespace.toUpperCase()}`,
          useValue: options.schema,
        },
      ],
      exports: [featureToken],
    };
  }
}
