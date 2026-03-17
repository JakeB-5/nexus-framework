// @nexus/validator - Comprehensive tests

import { describe, it, expect } from "vitest";
import {
  v,
  ValidationError,
  formatErrors,
  Schema,
} from "../src/index.js";
import type { Infer } from "../src/index.js";

// ============================================================
// STRING SCHEMA
// ============================================================
describe("StringSchema", () => {
  it("parses valid strings", () => {
    expect(v.string().parse("hello")).toBe("hello");
    expect(v.string().parse("")).toBe("");
  });

  it("rejects non-strings", () => {
    expect(() => v.string().parse(123)).toThrow(ValidationError);
    expect(() => v.string().parse(null)).toThrow(ValidationError);
    expect(() => v.string().parse(undefined)).toThrow(ValidationError);
    expect(() => v.string().parse(true)).toThrow(ValidationError);
    expect(() => v.string().parse({})).toThrow(ValidationError);
  });

  it("validates min length", () => {
    const schema = v.string().min(3);
    expect(schema.parse("abc")).toBe("abc");
    expect(() => schema.parse("ab")).toThrow(ValidationError);
  });

  it("validates max length", () => {
    const schema = v.string().max(3);
    expect(schema.parse("abc")).toBe("abc");
    expect(() => schema.parse("abcd")).toThrow(ValidationError);
  });

  it("validates exact length", () => {
    const schema = v.string().length(3);
    expect(schema.parse("abc")).toBe("abc");
    expect(() => schema.parse("ab")).toThrow(ValidationError);
    expect(() => schema.parse("abcd")).toThrow(ValidationError);
  });

  it("validates email", () => {
    const schema = v.string().email();
    expect(schema.parse("test@example.com")).toBe("test@example.com");
    expect(() => schema.parse("not-an-email")).toThrow(ValidationError);
    expect(() => schema.parse("@missing.local")).toThrow(ValidationError);
  });

  it("validates url", () => {
    const schema = v.string().url();
    expect(schema.parse("https://example.com")).toBe("https://example.com");
    expect(schema.parse("http://localhost:3000")).toBe("http://localhost:3000");
    expect(() => schema.parse("not-a-url")).toThrow(ValidationError);
  });

  it("validates uuid", () => {
    const schema = v.string().uuid();
    expect(schema.parse("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(() => schema.parse("not-a-uuid")).toThrow(ValidationError);
  });

  it("validates regex", () => {
    const schema = v.string().regex(/^[a-z]+$/);
    expect(schema.parse("hello")).toBe("hello");
    expect(() => schema.parse("Hello")).toThrow(ValidationError);
  });

  it("validates startsWith", () => {
    const schema = v.string().startsWith("pre_");
    expect(schema.parse("pre_test")).toBe("pre_test");
    expect(() => schema.parse("test")).toThrow(ValidationError);
  });

  it("validates endsWith", () => {
    const schema = v.string().endsWith(".ts");
    expect(schema.parse("file.ts")).toBe("file.ts");
    expect(() => schema.parse("file.js")).toThrow(ValidationError);
  });

  it("validates includes", () => {
    const schema = v.string().includes("needle");
    expect(schema.parse("find the needle here")).toBe("find the needle here");
    expect(() => schema.parse("nothing here")).toThrow(ValidationError);
  });

  it("validates nonempty", () => {
    const schema = v.string().nonempty();
    expect(schema.parse("a")).toBe("a");
    expect(() => schema.parse("")).toThrow(ValidationError);
  });

  it("validates ip", () => {
    const schema = v.string().ip();
    expect(schema.parse("192.168.1.1")).toBe("192.168.1.1");
    expect(schema.parse("255.255.255.0")).toBe("255.255.255.0");
    expect(() => schema.parse("999.999.999.999")).toThrow(ValidationError);
  });

  it("validates datetime", () => {
    const schema = v.string().datetime();
    expect(schema.parse("2024-01-01T00:00:00Z")).toBe("2024-01-01T00:00:00Z");
    expect(() => schema.parse("not-a-date")).toThrow(ValidationError);
  });

  it("validates cuid", () => {
    const schema = v.string().cuid();
    expect(schema.parse("cjld2cyuq0000t3rmniod1foy")).toBe("cjld2cyuq0000t3rmniod1foy");
    expect(() => schema.parse("not-a-cuid")).toThrow(ValidationError);
  });

  it("applies trim transform", () => {
    expect(v.string().trim().parse("  hello  ")).toBe("hello");
  });

  it("applies toLowerCase transform", () => {
    expect(v.string().toLowerCase().parse("HELLO")).toBe("hello");
  });

  it("applies toUpperCase transform", () => {
    expect(v.string().toUpperCase().parse("hello")).toBe("HELLO");
  });

  it("chains multiple validations", () => {
    const schema = v.string().min(2).max(10).trim();
    expect(schema.parse("  hello  ")).toBe("hello");
    expect(() => schema.parse(" a ")).toThrow(ValidationError);
  });

  it("supports custom error messages", () => {
    const schema = v.string().min(5, "Too short!");
    try {
      schema.parse("hi");
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).issues[0].message).toBe("Too short!");
    }
  });
});

// ============================================================
// NUMBER SCHEMA
// ============================================================
describe("NumberSchema", () => {
  it("parses valid numbers", () => {
    expect(v.number().parse(42)).toBe(42);
    expect(v.number().parse(0)).toBe(0);
    expect(v.number().parse(-1)).toBe(-1);
    expect(v.number().parse(3.14)).toBe(3.14);
  });

  it("rejects NaN", () => {
    expect(() => v.number().parse(NaN)).toThrow(ValidationError);
  });

  it("rejects non-numbers", () => {
    expect(() => v.number().parse("42")).toThrow(ValidationError);
    expect(() => v.number().parse(null)).toThrow(ValidationError);
    expect(() => v.number().parse(undefined)).toThrow(ValidationError);
  });

  it("validates min", () => {
    expect(v.number().min(5).parse(5)).toBe(5);
    expect(v.number().min(5).parse(10)).toBe(10);
    expect(() => v.number().min(5).parse(4)).toThrow(ValidationError);
  });

  it("validates max", () => {
    expect(v.number().max(10).parse(10)).toBe(10);
    expect(() => v.number().max(10).parse(11)).toThrow(ValidationError);
  });

  it("validates int", () => {
    expect(v.number().int().parse(5)).toBe(5);
    expect(() => v.number().int().parse(5.5)).toThrow(ValidationError);
  });

  it("validates positive", () => {
    expect(v.number().positive().parse(1)).toBe(1);
    expect(() => v.number().positive().parse(0)).toThrow(ValidationError);
    expect(() => v.number().positive().parse(-1)).toThrow(ValidationError);
  });

  it("validates negative", () => {
    expect(v.number().negative().parse(-1)).toBe(-1);
    expect(() => v.number().negative().parse(0)).toThrow(ValidationError);
  });

  it("validates finite", () => {
    expect(v.number().finite().parse(42)).toBe(42);
    expect(() => v.number().finite().parse(Infinity)).toThrow(ValidationError);
    expect(() => v.number().finite().parse(-Infinity)).toThrow(ValidationError);
  });

  it("validates multipleOf", () => {
    expect(v.number().multipleOf(3).parse(9)).toBe(9);
    expect(() => v.number().multipleOf(3).parse(10)).toThrow(ValidationError);
  });

  it("validates gt", () => {
    expect(v.number().gt(5).parse(6)).toBe(6);
    expect(() => v.number().gt(5).parse(5)).toThrow(ValidationError);
  });

  it("validates lt", () => {
    expect(v.number().lt(5).parse(4)).toBe(4);
    expect(() => v.number().lt(5).parse(5)).toThrow(ValidationError);
  });

  it("validates gte (alias of min)", () => {
    expect(v.number().gte(5).parse(5)).toBe(5);
    expect(() => v.number().gte(5).parse(4)).toThrow(ValidationError);
  });

  it("validates lte (alias of max)", () => {
    expect(v.number().lte(5).parse(5)).toBe(5);
    expect(() => v.number().lte(5).parse(6)).toThrow(ValidationError);
  });

  it("chains multiple validations", () => {
    const schema = v.number().int().positive().max(100);
    expect(schema.parse(50)).toBe(50);
    expect(() => schema.parse(0)).toThrow(ValidationError);
    expect(() => schema.parse(101)).toThrow(ValidationError);
    expect(() => schema.parse(50.5)).toThrow(ValidationError);
  });
});

// ============================================================
// BOOLEAN SCHEMA
// ============================================================
describe("BooleanSchema", () => {
  it("parses booleans", () => {
    expect(v.boolean().parse(true)).toBe(true);
    expect(v.boolean().parse(false)).toBe(false);
  });

  it("rejects non-booleans", () => {
    expect(() => v.boolean().parse(1)).toThrow(ValidationError);
    expect(() => v.boolean().parse("true")).toThrow(ValidationError);
    expect(() => v.boolean().parse(null)).toThrow(ValidationError);
  });
});

// ============================================================
// DATE SCHEMA
// ============================================================
describe("DateSchema", () => {
  it("parses valid dates", () => {
    const d = new Date("2024-01-01");
    expect(v.date().parse(d)).toEqual(d);
  });

  it("rejects non-dates", () => {
    expect(() => v.date().parse("2024-01-01")).toThrow(ValidationError);
    expect(() => v.date().parse(12345)).toThrow(ValidationError);
  });

  it("rejects invalid dates", () => {
    expect(() => v.date().parse(new Date("invalid"))).toThrow(ValidationError);
  });

  it("validates min date", () => {
    const min = new Date("2024-01-01");
    const schema = v.date().min(min);
    expect(schema.parse(new Date("2024-06-01"))).toBeTruthy();
    expect(() => schema.parse(new Date("2023-01-01"))).toThrow(ValidationError);
  });

  it("validates max date", () => {
    const max = new Date("2024-12-31");
    const schema = v.date().max(max);
    expect(schema.parse(new Date("2024-06-01"))).toBeTruthy();
    expect(() => schema.parse(new Date("2025-01-01"))).toThrow(ValidationError);
  });

  it("validates past", () => {
    const schema = v.date().past();
    expect(schema.parse(new Date("2000-01-01"))).toBeTruthy();
    expect(() => schema.parse(new Date("2099-01-01"))).toThrow(ValidationError);
  });

  it("validates future", () => {
    const schema = v.date().future();
    expect(schema.parse(new Date("2099-01-01"))).toBeTruthy();
    expect(() => schema.parse(new Date("2000-01-01"))).toThrow(ValidationError);
  });
});

// ============================================================
// ARRAY SCHEMA
// ============================================================
describe("ArraySchema", () => {
  it("parses valid arrays", () => {
    expect(v.array(v.number()).parse([1, 2, 3])).toEqual([1, 2, 3]);
    expect(v.array(v.string()).parse([])).toEqual([]);
  });

  it("rejects non-arrays", () => {
    expect(() => v.array(v.string()).parse("not array")).toThrow(ValidationError);
    expect(() => v.array(v.string()).parse({})).toThrow(ValidationError);
  });

  it("validates item types", () => {
    expect(() => v.array(v.number()).parse([1, "2", 3])).toThrow(ValidationError);
  });

  it("collects all item errors", () => {
    try {
      v.array(v.number()).parse(["a", "b"]);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).issues.length).toBe(2);
    }
  });

  it("validates min length", () => {
    expect(v.array(v.number()).min(2).parse([1, 2])).toEqual([1, 2]);
    expect(() => v.array(v.number()).min(2).parse([1])).toThrow(ValidationError);
  });

  it("validates max length", () => {
    expect(v.array(v.number()).max(2).parse([1])).toEqual([1]);
    expect(() => v.array(v.number()).max(2).parse([1, 2, 3])).toThrow(ValidationError);
  });

  it("validates exact length", () => {
    expect(v.array(v.number()).length(2).parse([1, 2])).toEqual([1, 2]);
    expect(() => v.array(v.number()).length(2).parse([1])).toThrow(ValidationError);
  });

  it("validates nonempty", () => {
    expect(v.array(v.number()).nonempty().parse([1])).toEqual([1]);
    expect(() => v.array(v.number()).nonempty().parse([])).toThrow(ValidationError);
  });

  it("validates unique", () => {
    expect(v.array(v.number()).unique().parse([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => v.array(v.number()).unique().parse([1, 2, 2])).toThrow(ValidationError);
  });

  it("validates unique with custom comparator", () => {
    const schema = v.array(v.string()).unique((a, b) => a.toLowerCase() === b.toLowerCase());
    expect(schema.parse(["a", "B"])).toEqual(["a", "B"]);
    expect(() => schema.parse(["a", "A"])).toThrow(ValidationError);
  });

  it("validates nested arrays", () => {
    const schema = v.array(v.array(v.number()));
    expect(schema.parse([[1, 2], [3]])).toEqual([[1, 2], [3]]);
    expect(() => schema.parse([[1, "x"]])).toThrow(ValidationError);
  });
});

// ============================================================
// OBJECT SCHEMA
// ============================================================
describe("ObjectSchema", () => {
  const userSchema = v.object({
    name: v.string(),
    age: v.number(),
  });

  it("parses valid objects", () => {
    expect(userSchema.parse({ name: "Alice", age: 30 })).toEqual({
      name: "Alice",
      age: 30,
    });
  });

  it("rejects non-objects", () => {
    expect(() => userSchema.parse(null)).toThrow(ValidationError);
    expect(() => userSchema.parse("string")).toThrow(ValidationError);
    expect(() => userSchema.parse([1, 2])).toThrow(ValidationError);
  });

  it("validates property types", () => {
    expect(() => userSchema.parse({ name: 123, age: "thirty" })).toThrow(ValidationError);
  });

  it("collects multiple field errors", () => {
    try {
      userSchema.parse({ name: 123, age: "bad" });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).issues.length).toBe(2);
    }
  });

  it("strips unknown keys by default", () => {
    const result = userSchema.parse({ name: "Alice", age: 30, extra: true });
    expect(result).toEqual({ name: "Alice", age: 30 });
    expect((result as Record<string, unknown>)["extra"]).toBeUndefined();
  });

  it("strict mode rejects unknown keys", () => {
    const strict = userSchema.strict();
    expect(() => strict.parse({ name: "Alice", age: 30, extra: true })).toThrow(
      ValidationError,
    );
  });

  it("passthrough mode keeps unknown keys", () => {
    const pass = userSchema.passthrough();
    const result = pass.parse({ name: "Alice", age: 30, extra: true });
    expect((result as Record<string, unknown>)["extra"]).toBe(true);
  });

  it("supports partial()", () => {
    const partial = userSchema.partial();
    expect(partial.parse({})).toEqual({ name: undefined, age: undefined });
    expect(partial.parse({ name: "Alice" })).toEqual({ name: "Alice", age: undefined });
  });

  it("supports pick()", () => {
    const nameOnly = userSchema.pick("name");
    expect(nameOnly.parse({ name: "Alice" })).toEqual({ name: "Alice" });
  });

  it("supports omit()", () => {
    const noAge = userSchema.omit("age");
    expect(noAge.parse({ name: "Alice" })).toEqual({ name: "Alice" });
  });

  it("supports extend()", () => {
    const extended = userSchema.extend({ email: v.string().email() });
    expect(extended.parse({ name: "Alice", age: 30, email: "a@b.com" })).toEqual({
      name: "Alice",
      age: 30,
      email: "a@b.com",
    });
  });

  it("supports merge()", () => {
    const other = v.object({ role: v.string() });
    const merged = userSchema.merge(other);
    expect(merged.parse({ name: "Alice", age: 30, role: "admin" })).toEqual({
      name: "Alice",
      age: 30,
      role: "admin",
    });
  });

  it("validates nested objects", () => {
    const schema = v.object({
      user: v.object({
        name: v.string(),
        address: v.object({
          city: v.string(),
        }),
      }),
    });
    const data = { user: { name: "Alice", address: { city: "NYC" } } };
    expect(schema.parse(data)).toEqual(data);
  });

  it("reports nested path errors", () => {
    const schema = v.object({
      user: v.object({
        name: v.string(),
      }),
    });
    try {
      schema.parse({ user: { name: 123 } });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const issue = (e as ValidationError).issues[0];
      expect(issue.path).toEqual(["user", "name"]);
    }
  });
});

// ============================================================
// UNION SCHEMA
// ============================================================
describe("UnionSchema", () => {
  it("matches first valid schema", () => {
    const schema = v.union([v.string(), v.number()]);
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(42)).toBe(42);
  });

  it("rejects if no schema matches", () => {
    const schema = v.union([v.string(), v.number()]);
    expect(() => schema.parse(true)).toThrow(ValidationError);
  });
});

// ============================================================
// INTERSECTION SCHEMA
// ============================================================
describe("IntersectionSchema", () => {
  it("merges two object schemas", () => {
    const a = v.object({ name: v.string() });
    const b = v.object({ age: v.number() });
    const schema = v.intersection(a, b);
    expect(schema.parse({ name: "Alice", age: 30 })).toEqual({
      name: "Alice",
      age: 30,
    });
  });
});

// ============================================================
// DISCRIMINATED UNION
// ============================================================
describe("DiscriminatedUnionSchema", () => {
  const catSchema = v.object({ type: v.literal("cat"), meow: v.boolean() });
  const dogSchema = v.object({ type: v.literal("dog"), bark: v.boolean() });

  it("dispatches based on discriminator", () => {
    const schema = v.discriminatedUnion("type", [catSchema, dogSchema]);
    expect(schema.parse({ type: "cat", meow: true })).toEqual({ type: "cat", meow: true });
    expect(schema.parse({ type: "dog", bark: true })).toEqual({ type: "dog", bark: true });
  });

  it("rejects missing discriminator", () => {
    const schema = v.discriminatedUnion("type", [catSchema, dogSchema]);
    expect(() => schema.parse({ meow: true })).toThrow(ValidationError);
  });

  it("rejects invalid discriminator value", () => {
    const schema = v.discriminatedUnion("type", [catSchema, dogSchema]);
    expect(() => schema.parse({ type: "bird", fly: true })).toThrow(ValidationError);
  });
});

// ============================================================
// ENUM SCHEMA
// ============================================================
describe("EnumSchema", () => {
  it("accepts valid enum values", () => {
    const schema = v.enum(["red", "green", "blue"] as const);
    expect(schema.parse("red")).toBe("red");
    expect(schema.parse("green")).toBe("green");
  });

  it("rejects invalid values", () => {
    const schema = v.enum(["red", "green", "blue"] as const);
    expect(() => schema.parse("yellow")).toThrow(ValidationError);
    expect(() => schema.parse(123)).toThrow(ValidationError);
  });

  it("exposes options", () => {
    const schema = v.enum(["a", "b", "c"] as const);
    expect(schema.options).toEqual(["a", "b", "c"]);
  });
});

// ============================================================
// NATIVE ENUM SCHEMA
// ============================================================
describe("NativeEnumSchema", () => {
  enum Color {
    Red = "RED",
    Green = "GREEN",
    Blue = "BLUE",
  }

  it("accepts valid native enum values", () => {
    const schema = v.nativeEnum(Color);
    expect(schema.parse("RED")).toBe("RED");
    expect(schema.parse("GREEN")).toBe("GREEN");
  });

  it("rejects invalid values", () => {
    const schema = v.nativeEnum(Color);
    expect(() => schema.parse("YELLOW")).toThrow(ValidationError);
  });

  enum NumericStatus {
    Active = 0,
    Inactive = 1,
  }

  it("handles numeric enums", () => {
    const schema = v.nativeEnum(NumericStatus);
    expect(schema.parse(0)).toBe(0);
    expect(schema.parse(1)).toBe(1);
    expect(() => schema.parse(2)).toThrow(ValidationError);
  });
});

// ============================================================
// TUPLE SCHEMA
// ============================================================
describe("TupleSchema", () => {
  it("validates fixed-length tuples", () => {
    const schema = v.tuple([v.string(), v.number()]);
    expect(schema.parse(["hello", 42])).toEqual(["hello", 42]);
  });

  it("rejects wrong length", () => {
    const schema = v.tuple([v.string(), v.number()]);
    expect(() => schema.parse(["hello"])).toThrow(ValidationError);
    expect(() => schema.parse(["hello", 42, true])).toThrow(ValidationError);
  });

  it("validates item types", () => {
    const schema = v.tuple([v.string(), v.number()]);
    expect(() => schema.parse([42, "hello"])).toThrow(ValidationError);
  });

  it("supports rest schema", () => {
    const schema = v.tuple([v.string()]).rest(v.number());
    expect(schema.parse(["hello", 1, 2, 3])).toEqual(["hello", 1, 2, 3]);
    expect(() => schema.parse(["hello", 1, "bad"])).toThrow(ValidationError);
  });

  it("rejects non-arrays", () => {
    const schema = v.tuple([v.string()]);
    expect(() => schema.parse("not array")).toThrow(ValidationError);
  });
});

// ============================================================
// RECORD SCHEMA
// ============================================================
describe("RecordSchema", () => {
  it("validates record entries", () => {
    const schema = v.record(v.string(), v.number());
    expect(schema.parse({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("rejects invalid values", () => {
    const schema = v.record(v.string(), v.number());
    expect(() => schema.parse({ a: "not number" })).toThrow(ValidationError);
  });

  it("rejects non-objects", () => {
    const schema = v.record(v.string(), v.number());
    expect(() => schema.parse([])).toThrow(ValidationError);
    expect(() => schema.parse(null)).toThrow(ValidationError);
  });
});

// ============================================================
// LITERAL SCHEMA
// ============================================================
describe("LiteralSchema", () => {
  it("accepts exact string match", () => {
    expect(v.literal("hello").parse("hello")).toBe("hello");
  });

  it("accepts exact number match", () => {
    expect(v.literal(42).parse(42)).toBe(42);
  });

  it("accepts exact boolean match", () => {
    expect(v.literal(true).parse(true)).toBe(true);
  });

  it("accepts null literal", () => {
    expect(v.literal(null).parse(null)).toBe(null);
  });

  it("rejects non-matching values", () => {
    expect(() => v.literal("hello").parse("world")).toThrow(ValidationError);
    expect(() => v.literal(42).parse(43)).toThrow(ValidationError);
    expect(() => v.literal(true).parse(false)).toThrow(ValidationError);
  });
});

// ============================================================
// SPECIAL SCHEMAS
// ============================================================
describe("Special schemas", () => {
  it("v.any() accepts anything", () => {
    expect(v.any().parse("hello")).toBe("hello");
    expect(v.any().parse(42)).toBe(42);
    expect(v.any().parse(null)).toBe(null);
    expect(v.any().parse(undefined)).toBe(undefined);
  });

  it("v.unknown() accepts anything", () => {
    expect(v.unknown().parse("hello")).toBe("hello");
    expect(v.unknown().parse(null)).toBe(null);
  });

  it("v.never() rejects everything", () => {
    expect(() => v.never().parse("anything")).toThrow(ValidationError);
    expect(() => v.never().parse(undefined)).toThrow(ValidationError);
  });

  it("v.void() accepts undefined/null", () => {
    expect(v.void().parse(undefined)).toBe(undefined);
    expect(v.void().parse(null)).toBe(undefined);
    expect(() => v.void().parse("string")).toThrow(ValidationError);
  });

  it("v.instanceof() validates class instances", () => {
    class MyClass {
      value = 1;
    }
    const schema = v.instanceof(MyClass);
    expect(schema.parse(new MyClass())).toBeInstanceOf(MyClass);
    expect(() => schema.parse({})).toThrow(ValidationError);
  });

  it("v.lazy() supports recursive types", () => {
    type Tree = { value: number; children: Tree[] };
    const treeSchema: Schema<Tree> = v.object({
      value: v.number(),
      children: v.array(v.lazy(() => treeSchema)),
    }) as Schema<Tree>;

    const data: Tree = {
      value: 1,
      children: [
        { value: 2, children: [] },
        { value: 3, children: [{ value: 4, children: [] }] },
      ],
    };
    expect(treeSchema.parse(data)).toEqual(data);
  });

  it("v.promise() validates promises", async () => {
    const schema = v.promise(v.string());
    const result = schema.parse(Promise.resolve("hello"));
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("hello");
  });

  it("v.promise() rejects non-promises", () => {
    const schema = v.promise(v.string());
    expect(() => schema.parse("not a promise")).toThrow(ValidationError);
  });

  it("v.custom() with direct return", () => {
    const schema = v.custom<number>((data) => {
      if (typeof data === "number" && data > 0) return data;
      throw new Error("Must be positive number");
    });
    expect(schema.parse(5)).toBe(5);
    expect(() => schema.parse(-1)).toThrow(ValidationError);
  });
});

// ============================================================
// SCHEMA BASE FEATURES
// ============================================================
describe("Schema base features", () => {
  it("optional() accepts undefined", () => {
    const schema = v.string().optional();
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(undefined)).toBe(undefined);
  });

  it("nullable() accepts null", () => {
    const schema = v.string().nullable();
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(null)).toBe(null);
  });

  it("default() provides fallback", () => {
    const schema = v.string().default("fallback");
    expect(schema.parse(undefined)).toBe("fallback");
    expect(schema.parse("custom")).toBe("custom");
  });

  it("default() with factory function", () => {
    let counter = 0;
    const schema = v.number().default(() => ++counter);
    expect(schema.parse(undefined)).toBe(1);
    expect(schema.parse(undefined)).toBe(2);
  });

  it("transform() modifies output", () => {
    const schema = v.string().transform((s) => s.length);
    expect(schema.parse("hello")).toBe(5);
  });

  it("refine() adds custom validation", () => {
    const schema = v.number().refine((n) => n % 2 === 0, "Must be even");
    expect(schema.parse(4)).toBe(4);
    expect(() => schema.parse(3)).toThrow(ValidationError);
  });

  it("refine() with object message", () => {
    const schema = v.number().refine((n) => n > 0, { message: "Must be positive" });
    expect(() => schema.parse(-1)).toThrow(ValidationError);
  });

  it("pipe() chains schemas", () => {
    const stringToNum = v.string().transform(Number).pipe(v.number().int());
    expect(stringToNum.parse("42")).toBe(42);
    expect(() => stringToNum.parse("3.14")).toThrow(ValidationError);
  });

  it("safeParse() returns success", () => {
    const result = v.string().safeParse("hello");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("hello");
    }
  });

  it("safeParse() returns error", () => {
    const result = v.string().safeParse(123);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// ERROR FORMATTING
// ============================================================
describe("ValidationError", () => {
  it("formats single error", () => {
    try {
      v.string().parse(123);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const err = e as ValidationError;
      expect(err.message).toContain("Expected string");
      expect(formatErrors(err)).toBe(err.message);
    }
  });

  it("flatten() separates form and field errors", () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
    });
    try {
      schema.parse({ name: 123, age: "bad" });
      expect.unreachable("should throw");
    } catch (e) {
      const err = e as ValidationError;
      const flat = err.flatten();
      expect(flat.formErrors).toEqual([]);
      expect(flat.fieldErrors["name"]).toBeDefined();
      expect(flat.fieldErrors["age"]).toBeDefined();
    }
  });

  it("formats multiple errors", () => {
    try {
      v.object({ a: v.string(), b: v.number() }).parse({ a: 1, b: "x" });
      expect.unreachable("should throw");
    } catch (e) {
      const err = e as ValidationError;
      expect(err.issues.length).toBe(2);
      expect(err.message).toContain("2 validation issues");
    }
  });
});

// ============================================================
// TYPE INFERENCE (compile-time checks)
// ============================================================
describe("Type inference", () => {
  it("infers primitive types", () => {
    const strSchema = v.string();
    type S = Infer<typeof strSchema>;
    const _s: S = "hello";
    expect(_s).toBe("hello");

    const numSchema = v.number();
    type N = Infer<typeof numSchema>;
    const _n: N = 42;
    expect(_n).toBe(42);
  });

  it("infers object types", () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
      active: v.boolean(),
    });
    type User = Infer<typeof schema>;
    const user: User = { name: "Alice", age: 30, active: true };
    expect(user.name).toBe("Alice");
  });

  it("infers array types", () => {
    const schema = v.array(v.string());
    type SA = Infer<typeof schema>;
    const _arr: SA = ["a", "b"];
    expect(_arr.length).toBe(2);
  });

  it("infers enum types", () => {
    const schema = v.enum(["a", "b", "c"] as const);
    type E = Infer<typeof schema>;
    const _e: E = "a";
    expect(_e).toBe("a");
  });

  it("infers literal types", () => {
    const schema = v.literal("hello");
    type L = Infer<typeof schema>;
    const _l: L = "hello";
    expect(_l).toBe("hello");
  });
});

// ============================================================
// IMMUTABILITY / CLONING
// ============================================================
describe("Schema immutability", () => {
  it("methods return new instances", () => {
    const base = v.string();
    const withMin = base.min(3);
    const withMax = base.max(10);

    // base should not be affected
    expect(base.parse("a")).toBe("a");
    expect(() => withMin.parse("a")).toThrow(ValidationError);
    expect(withMax.parse("a")).toBe("a");
  });

  it("optional/nullable return new schemas", () => {
    const base = v.string();
    const opt = base.optional();
    const nul = base.nullable();

    expect(() => base.parse(undefined)).toThrow(ValidationError);
    expect(opt.parse(undefined)).toBe(undefined);
    expect(() => base.parse(null)).toThrow(ValidationError);
    expect(nul.parse(null)).toBe(null);
  });
});
