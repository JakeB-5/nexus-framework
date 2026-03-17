// @nexus/openapi - Schema conversion utilities

import type { SchemaObject } from "./types.js";

/**
 * Convert a TypeScript-like type descriptor to OpenAPI schema
 */
export function typeToSchema(type: string): SchemaObject {
  switch (type.toLowerCase()) {
    case "string": return { type: "string" };
    case "number": return { type: "number" };
    case "integer":
    case "int": return { type: "integer" };
    case "boolean":
    case "bool": return { type: "boolean" };
    case "date": return { type: "string", format: "date" };
    case "datetime": return { type: "string", format: "date-time" };
    case "email": return { type: "string", format: "email" };
    case "uri":
    case "url": return { type: "string", format: "uri" };
    case "uuid": return { type: "string", format: "uuid" };
    case "binary": return { type: "string", format: "binary" };
    case "byte": return { type: "string", format: "byte" };
    case "password": return { type: "string", format: "password" };
    case "object": return { type: "object" };
    case "any": return {};
    default: {
      // Check for array types like "string[]" or "Array<string>"
      if (type.endsWith("[]")) {
        const itemType = type.slice(0, -2);
        return { type: "array", items: typeToSchema(itemType) };
      }
      const arrayMatch = type.match(/^Array<(.+)>$/i);
      if (arrayMatch) {
        return { type: "array", items: typeToSchema(arrayMatch[1]) };
      }
      // Treat as $ref
      return { $ref: `#/components/schemas/${type}` };
    }
  }
}

/**
 * Build an object schema from a properties map
 */
export function objectSchema(config: {
  properties: Record<string, SchemaObject | string>;
  required?: string[];
  description?: string;
  nullable?: boolean;
}): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  for (const [key, value] of Object.entries(config.properties)) {
    properties[key] = typeof value === "string" ? typeToSchema(value) : value;
  }
  const schema: SchemaObject = { type: "object", properties };
  if (config.required && config.required.length > 0) {
    schema.required = config.required;
  }
  if (config.description) {
    schema.description = config.description;
  }
  if (config.nullable) {
    schema.nullable = true;
  }
  return schema;
}

/**
 * Create an array schema
 */
export function arraySchema(items: SchemaObject | string, options?: { minItems?: number; maxItems?: number; uniqueItems?: boolean }): SchemaObject {
  const schema: SchemaObject = {
    type: "array",
    items: typeof items === "string" ? typeToSchema(items) : items,
  };
  if (options?.minItems !== undefined) schema.minItems = options.minItems;
  if (options?.maxItems !== undefined) schema.maxItems = options.maxItems;
  if (options?.uniqueItems !== undefined) schema.uniqueItems = options.uniqueItems;
  return schema;
}

/**
 * Create a oneOf schema
 */
export function oneOfSchema(...schemas: Array<SchemaObject | string>): SchemaObject {
  return {
    oneOf: schemas.map((s) => (typeof s === "string" ? typeToSchema(s) : s)),
  };
}

/**
 * Create an anyOf schema
 */
export function anyOfSchema(...schemas: Array<SchemaObject | string>): SchemaObject {
  return {
    anyOf: schemas.map((s) => (typeof s === "string" ? typeToSchema(s) : s)),
  };
}

/**
 * Create an allOf schema
 */
export function allOfSchema(...schemas: Array<SchemaObject | string>): SchemaObject {
  return {
    allOf: schemas.map((s) => (typeof s === "string" ? typeToSchema(s) : s)),
  };
}

/**
 * Create an enum schema
 */
export function enumSchema(values: unknown[], type = "string"): SchemaObject {
  return { type, enum: values };
}

/**
 * Create a $ref schema
 */
export function refSchema(name: string): SchemaObject {
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * Make a schema nullable
 */
export function nullable(schema: SchemaObject): SchemaObject {
  return { ...schema, nullable: true };
}
