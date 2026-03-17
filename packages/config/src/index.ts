// @nexus/config - Public API

// Types
export type {
  ConfigSchema,
  ConfigSchemaProperty,
  ConfigLoader,
  ConfigModuleOptions,
  ConfigFeatureOptions,
  ConfigValidationDetail,
} from "./types.js";

// Errors
export {
  ConfigError,
  ConfigValidationError,
  ConfigNotFoundError,
} from "./errors.js";

// Config Service
export { ConfigService } from "./config-service.js";

// Module
export { ConfigModule } from "./config-module.js";

// Schema utilities
export {
  defineConfig,
  extractDefaults,
  validateConfig,
  assertConfigValid,
} from "./schema.js";

// Loaders
export { EnvLoader, parseEnvContent } from "./loaders/env-loader.js";
export type { EnvLoaderOptions } from "./loaders/env-loader.js";
export { FileLoader } from "./loaders/file-loader.js";
export type { FileLoaderOptions } from "./loaders/file-loader.js";
