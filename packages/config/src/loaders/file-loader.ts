// @nexus/config - File-based configuration loader

import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfigLoader } from "../types.js";
import { ConfigError } from "../errors.js";

export interface FileLoaderOptions {
  /** Path to the config file (JSON) */
  filePath: string;
  /** Whether the file is required (throws if missing) */
  required?: boolean;
  /** Environment suffix to look for (e.g., "development" → config.development.json) */
  environment?: string;
}

/**
 * Loads configuration from JSON files.
 * Supports environment-specific config files and deep merging.
 */
export class FileLoader implements ConfigLoader {
  readonly name = "file";
  private readonly options: FileLoaderOptions;

  constructor(options: FileLoaderOptions) {
    this.options = options;
  }

  load(): Record<string, unknown> {
    let config: Record<string, unknown> = {};

    // Load base config file
    const baseConfig = this.loadFile(this.options.filePath);
    if (baseConfig) {
      config = baseConfig;
    } else if (this.options.required) {
      throw new ConfigError(
        `Required config file not found: ${this.options.filePath}`,
      );
    }

    // Load environment-specific config file
    if (this.options.environment) {
      const envPath = this.getEnvironmentPath(
        this.options.filePath,
        this.options.environment,
      );
      const envConfig = this.loadFile(envPath);
      if (envConfig) {
        config = deepMergeConfig(config, envConfig);
      }
    }

    return config;
  }

  /**
   * Load and parse a JSON file
   */
  private loadFile(filePath: string): Record<string, unknown> | null {
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      return JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      throw new ConfigError(`Failed to parse config file: ${resolvedPath}`, {
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  /**
   * Get environment-specific file path.
   * e.g., config.json → config.development.json
   */
  private getEnvironmentPath(
    basePath: string,
    environment: string,
  ): string {
    const ext = path.extname(basePath);
    const base = basePath.slice(0, -ext.length);
    return `${base}.${environment}${ext}`;
  }
}

/**
 * Deep merge two config objects. Source values override target values.
 * Arrays are replaced, not merged.
 */
function deepMergeConfig(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];

    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMergeConfig(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
