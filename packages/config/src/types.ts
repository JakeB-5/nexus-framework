// @nexus/config - Type definitions

/**
 * Configuration schema definition
 */
export interface ConfigSchemaProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  default?: unknown;
  required?: boolean;
  description?: string;
  env?: string;
  properties?: Record<string, ConfigSchemaProperty>;
  items?: ConfigSchemaProperty;
}

export type ConfigSchema = Record<string, ConfigSchemaProperty>;

/**
 * Config loader interface - all loaders implement this
 */
export interface ConfigLoader {
  /** Unique name for this loader */
  readonly name: string;
  /** Load configuration and return a plain object */
  load(): Record<string, unknown> | Promise<Record<string, unknown>>;
}

/**
 * Options for ConfigModule.forRoot()
 */
export interface ConfigModuleOptions {
  /** Whether to make config globally available */
  global?: boolean;
  /** Config loaders to use (in order of precedence, last wins) */
  loaders?: ConfigLoader[];
  /** Inline default values */
  defaults?: Record<string, unknown>;
  /** Schema for validation */
  schema?: ConfigSchema;
  /** Environment variable prefix to auto-load (e.g., "NEXUS_") */
  envPrefix?: string;
  /** Path to .env file */
  envFilePath?: string;
  /** Whether to validate config on load */
  validate?: boolean;
}

/**
 * Options for ConfigModule.forFeature()
 */
export interface ConfigFeatureOptions {
  /** Schema for the feature config */
  schema: ConfigSchema;
  /** Namespace/prefix for the feature config */
  namespace: string;
}

/**
 * Validation error detail
 */
export interface ConfigValidationDetail {
  path: string;
  message: string;
  expected?: string;
  received?: string;
}
