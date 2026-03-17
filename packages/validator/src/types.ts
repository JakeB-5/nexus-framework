// @nexus/validator - Core type definitions

import type { Schema } from "./schema.js";

/**
 * Infer the output type of a schema
 */
export type Infer<T extends Schema<unknown>> = T extends Schema<infer U> ? U : never;

/**
 * Infer the input type of a schema (same as output for most schemas)
 */
export type InferInput<T extends Schema<unknown>> = T extends Schema<infer U> ? U : never;

/**
 * Infer the output type of a schema
 */
export type InferOutput<T extends Schema<unknown>> = Infer<T>;

/**
 * Result type for safe parsing
 */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: import("./errors.js").ValidationError };

/**
 * Shape type for object schemas
 */
export type ObjectShape = Record<string, Schema<unknown>>;

/**
 * Infer an object type from a shape
 */
export type InferShape<T extends ObjectShape> = {
  [K in keyof T]: Infer<T[K]>;
};

/**
 * Make all properties optional in a shape
 */
export type PartialShape<T extends ObjectShape> = {
  [K in keyof T]: Schema<Infer<T[K]> | undefined>;
};

/**
 * Make all properties required in a shape
 */
export type RequiredShape<T extends ObjectShape> = {
  [K in keyof T]: Schema<Exclude<Infer<T[K]>, undefined>>;
};
