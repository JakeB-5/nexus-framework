// @nexus/validator - Main v namespace object

import { StringSchema } from "./types/string.js";
import { NumberSchema } from "./types/number.js";
import { BooleanSchema } from "./types/boolean.js";
import { DateSchema } from "./types/date.js";
import { ArraySchema } from "./types/array.js";
import { ObjectSchema } from "./types/object.js";
import { UnionSchema, IntersectionSchema, DiscriminatedUnionSchema } from "./types/union.js";
import { EnumSchema, NativeEnumSchema } from "./types/enum.js";
import { TupleSchema } from "./types/tuple.js";
import { RecordSchema } from "./types/record.js";
import { LiteralSchema } from "./types/literal.js";
import {
  AnySchema,
  UnknownSchema,
  NeverSchema,
  VoidSchema,
  InstanceOfSchema,
  LazySchema,
  PromiseSchema,
  CustomSchema,
} from "./types/special.js";
import type { Schema } from "./schema.js";
import type { ObjectShape } from "./types.js";

type Primitive = string | number | boolean | null | undefined;

/**
 * The main validator namespace. All type builders are accessed through this object.
 *
 * @example
 * ```ts
 * import { v } from "@nexus/validator";
 *
 * const userSchema = v.object({
 *   name: v.string().min(1),
 *   age: v.number().int().positive(),
 *   email: v.string().email(),
 * });
 *
 * const user = userSchema.parse(input);
 * ```
 */
export const v = {
  // Primitive types
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  date: () => new DateSchema(),

  // Composite types
  array: <T>(schema: Schema<T>) => new ArraySchema(schema),
  object: <S extends ObjectShape>(shape: S) => new ObjectSchema(shape),
  tuple: <T extends Schema<unknown>[]>(items: [...T]) => new TupleSchema(items),
  record: <K extends string, V>(keySchema: Schema<K>, valueSchema: Schema<V>) =>
    new RecordSchema(keySchema, valueSchema),

  // Union & Intersection
  union: <T extends Schema<unknown>[]>(schemas: [...T]) =>
    new UnionSchema(schemas as unknown as Schema<unknown>[]) as UnionSchema<
      T[number] extends Schema<infer U> ? U : never
    >,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intersection: <A, B>(left: Schema<A>, right: Schema<B>) =>
    new IntersectionSchema<A & B>(left as any, right as any),
  discriminatedUnion: <T>(discriminator: string, schemas: Schema<T>[]) =>
    new DiscriminatedUnionSchema(discriminator, schemas),

  // Enum
  enum: <T extends string>(values: readonly T[]) => new EnumSchema(values),
  nativeEnum: <T extends Record<string, string | number>>(enumObj: T) =>
    new NativeEnumSchema(enumObj),

  // Literal
  literal: <T extends Primitive>(value: T) => new LiteralSchema(value),

  // Special types
  any: () => new AnySchema(),
  unknown: () => new UnknownSchema(),
  never: () => new NeverSchema(),
  void: () => new VoidSchema(),
  instanceof: <T>(cls: new (...args: unknown[]) => T) => new InstanceOfSchema(cls),
  lazy: <T>(getter: () => Schema<T>) => new LazySchema(getter),
  promise: <T>(schema: Schema<T>) => new PromiseSchema(schema),
  custom: <T>(validator: (data: unknown) => T | { success: true; data: T } | { success: false; message: string }) =>
    new CustomSchema<T>(validator),
} as const;
