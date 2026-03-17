/**
 * Application Configuration
 *
 * In a real Nexus application, you would use @nexus/config to define
 * a typed configuration schema with validation, environment variable
 * binding, and defaults. Here we demonstrate the same pattern inline.
 *
 * @nexus/config equivalent:
 *   const config = defineConfig({
 *     server: { port: env('PORT', 3000), host: env('HOST', 'localhost') },
 *     auth: { secret: env('JWT_SECRET'), expiresIn: '24h' },
 *     cors: { origins: env('CORS_ORIGINS', '*') },
 *   });
 */

// ---------------------------------------------------------------------------
// Configuration types - mirrors @nexus/config schema definitions
// ---------------------------------------------------------------------------

export interface ServerConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
}

export interface AuthConfig {
  /** Secret key for signing JWTs */
  secret: string;
  /** Token expiration time in seconds */
  expiresInSeconds: number;
  /** Hash algorithm for passwords */
  hashAlgorithm: string;
  /** Salt length for password hashing */
  saltLength: number;
}

export interface CorsConfig {
  /** Allowed origins (comma-separated or '*') */
  origins: string[];
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed headers */
  headers: string[];
  /** Whether to allow credentials */
  credentials: boolean;
}

export interface LogConfig {
  /** Log level: 'debug' | 'info' | 'warn' | 'error' */
  level: string;
  /** Whether to include timestamps */
  timestamps: boolean;
  /** Whether to colorize output */
  colorize: boolean;
}

export interface AppConfig {
  server: ServerConfig;
  auth: AuthConfig;
  cors: CorsConfig;
  log: LogConfig;
}

// ---------------------------------------------------------------------------
// Environment helpers - simplified version of @nexus/config env() binding
// ---------------------------------------------------------------------------

function env(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === "true" || val === "1";
}

function envList(key: string, defaultValue: string[]): string[] {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val.split(",").map((s) => s.trim());
}

// ---------------------------------------------------------------------------
// Application configuration - loaded once at startup
// ---------------------------------------------------------------------------

export const config: AppConfig = {
  server: {
    port: envInt("PORT", 3000),
    host: env("HOST", "localhost"),
  },

  auth: {
    secret: env("JWT_SECRET", "nexus-example-secret-change-in-production"),
    expiresInSeconds: envInt("JWT_EXPIRES_IN", 86400), // 24 hours
    hashAlgorithm: "sha256",
    saltLength: 32,
  },

  cors: {
    origins: envList("CORS_ORIGINS", ["*"]),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-Request-ID"],
    credentials: envBool("CORS_CREDENTIALS", true),
  },

  log: {
    level: env("LOG_LEVEL", "info"),
    timestamps: envBool("LOG_TIMESTAMPS", true),
    colorize: envBool("LOG_COLORIZE", true),
  },
};
