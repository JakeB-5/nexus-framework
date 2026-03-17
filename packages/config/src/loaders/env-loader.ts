// @nexus/config - Environment variable loader

import * as fs from "node:fs";
import * as path from "node:path";
import type { ConfigLoader } from "../types.js";

export interface EnvLoaderOptions {
  /** Prefix to filter env vars (e.g., "NEXUS_") */
  prefix?: string;
  /** Path to .env file */
  envFilePath?: string;
  /** Whether to override existing env vars with .env file values */
  override?: boolean;
}

/**
 * Loads configuration from environment variables.
 * Supports:
 * - Variable expansion (${VAR})
 * - Prefix filtering
 * - Type coercion (string → number, boolean)
 * - .env file parsing
 */
export class EnvLoader implements ConfigLoader {
  readonly name = "env";
  private readonly options: EnvLoaderOptions;

  constructor(options: EnvLoaderOptions = {}) {
    this.options = options;
  }

  load(): Record<string, unknown> {
    // Load .env file first if specified
    if (this.options.envFilePath) {
      this.loadEnvFile(this.options.envFilePath);
    }

    const result: Record<string, unknown> = {};
    const prefix = this.options.prefix ?? "";

    for (const [key, rawValue] of Object.entries(process.env)) {
      if (!prefix || key.startsWith(prefix)) {
        const configKey = prefix
          ? key.slice(prefix.length).toLowerCase().replace(/_/g, ".")
          : key.toLowerCase().replace(/_/g, ".");

        if (rawValue !== undefined) {
          const expanded = this.expandVariables(rawValue);
          const coerced = this.coerceType(expanded);
          this.setNestedValue(result, configKey, coerced);
        }
      }
    }

    return result;
  }

  /**
   * Parse and load a .env file into process.env
   */
  private loadEnvFile(filePath: string): void {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return; // Silently skip if file doesn't exist
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Remove inline comments (only for unquoted values)
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1 && !trimmed.slice(eqIndex + 1).trim().startsWith('"')) {
        value = value.slice(0, commentIndex).trim();
      }

      // Only set if not already set (unless override is true)
      if (this.options.override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  /**
   * Expand ${VAR} references in a value string
   */
  private expandVariables(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      return process.env[varName] ?? "";
    });
  }

  /**
   * Coerce string values to appropriate types
   */
  private coerceType(value: string): unknown {
    // Boolean
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Number
    if (value !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }

    // JSON arrays/objects
    if (
      (value.startsWith("[") && value.endsWith("]")) ||
      (value.startsWith("{") && value.endsWith("}"))
    ) {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        // Not valid JSON, return as string
      }
    }

    return value;
  }

  /**
   * Set a value in a nested object using dot-notation key
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    const parts = key.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        current[part] === undefined ||
        typeof current[part] !== "object" ||
        current[part] === null
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }
}

/**
 * Parse a .env file content string into key-value pairs
 */
export function parseEnvContent(
  content: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}
