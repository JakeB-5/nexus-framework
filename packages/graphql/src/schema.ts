// @nexus/graphql - Schema building from SDL

import { SchemaError } from "./errors.js";
import { parse } from "./parser.js";
import {
  type DocumentNode,
  type EnumTypeDefinitionNode,
  type FieldDefinitionNode,
  type GraphQLArgument,
  type GraphQLEnumValue,
  type GraphQLInputField,
  type GraphQLInputObjectType,
  type GraphQLInterfaceType,
  type GraphQLNamedType,
  type GraphQLObjectField,
  type GraphQLObjectType,
  type GraphQLScalarType,
  type GraphQLSchema,
  type GraphQLType,
  type GraphQLUnionType,
  type InputObjectTypeDefinitionNode,
  type InputValueDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type ObjectTypeDefinitionNode,
  type ScalarTypeDefinitionNode,
  type TypeNode,
  type UnionTypeDefinitionNode,
  type ValueNode,
  NodeKind,
  OperationType,
} from "./types.js";

// ─── Built-in Scalars ─────────────────────────────────────────────────────

function createBuiltinScalar(
  name: string,
  serialize: (v: unknown) => unknown,
  parseValue: (v: unknown) => unknown,
  parseLiteral: (ast: ValueNode) => unknown,
): GraphQLScalarType {
  return { kind: "SCALAR", name, serialize, parseValue, parseLiteral };
}

const GraphQLString = createBuiltinScalar(
  "String",
  (v) => String(v),
  (v) => {
    if (typeof v !== "string") throw new TypeError("String expected");
    return v;
  },
  (ast) => {
    if (ast.kind === NodeKind.StringValue) return ast.value;
    return undefined;
  },
);

const GraphQLInt = createBuiltinScalar(
  "Int",
  (v) => {
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(num)) return null;
    if (num > 2147483647 || num < -2147483648) return null;
    return num;
  },
  (v) => {
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(num)) throw new TypeError("Int expected");
    return num;
  },
  (ast) => {
    if (ast.kind === NodeKind.IntValue) return parseInt(ast.value, 10);
    return undefined;
  },
);

const GraphQLFloat = createBuiltinScalar(
  "Float",
  (v) => {
    const num = typeof v === "number" ? v : Number(v);
    return Number.isFinite(num) ? num : null;
  },
  (v) => {
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num)) throw new TypeError("Float expected");
    return num;
  },
  (ast) => {
    if (ast.kind === NodeKind.FloatValue || ast.kind === NodeKind.IntValue) {
      return parseFloat(ast.value);
    }
    return undefined;
  },
);

const GraphQLBoolean = createBuiltinScalar(
  "Boolean",
  (v) => Boolean(v),
  (v) => {
    if (typeof v !== "boolean") throw new TypeError("Boolean expected");
    return v;
  },
  (ast) => {
    if (ast.kind === NodeKind.BooleanValue) return ast.value;
    return undefined;
  },
);

const GraphQLID = createBuiltinScalar(
  "ID",
  (v) => String(v),
  (v) => String(v),
  (ast) => {
    if (ast.kind === NodeKind.StringValue || ast.kind === NodeKind.IntValue) {
      return ast.value;
    }
    return undefined;
  },
);

const BUILT_IN_SCALARS: ReadonlyMap<string, GraphQLScalarType> = new Map([
  ["String", GraphQLString],
  ["Int", GraphQLInt],
  ["Float", GraphQLFloat],
  ["Boolean", GraphQLBoolean],
  ["ID", GraphQLID],
]);

export { GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLID, BUILT_IN_SCALARS };

// ─── Type Registry ────────────────────────────────────────────────────────

export class TypeRegistry {
  private types = new Map<string, GraphQLNamedType>();

  constructor() {
    // Register built-in scalars
    for (const [name, scalar] of BUILT_IN_SCALARS) {
      this.types.set(name, scalar);
    }
  }

  register(type: GraphQLNamedType): void {
    if (this.types.has(type.name) && !BUILT_IN_SCALARS.has(type.name)) {
      throw new SchemaError(`Duplicate type: ${type.name}`);
    }
    this.types.set(type.name, type);
  }

  get(name: string): GraphQLNamedType | undefined {
    return this.types.get(name);
  }

  has(name: string): boolean {
    return this.types.has(name);
  }

  getAll(): Map<string, GraphQLNamedType> {
    return new Map(this.types);
  }
}

// ─── Schema Builder ───────────────────────────────────────────────────────

export function buildSchema(sdl: string): GraphQLSchema {
  const document = parse(sdl);
  return buildSchemaFromDocument(document);
}

export function buildSchemaFromDocument(document: DocumentNode): GraphQLSchema {
  const registry = new TypeRegistry();

  // First pass: register all type names (forward references)
  for (const def of document.definitions) {
    switch (def.kind) {
      case NodeKind.ScalarTypeDefinition:
        registerScalarType(registry, def);
        break;
      case NodeKind.ObjectTypeDefinition:
        registerObjectTypePlaceholder(registry, def);
        break;
      case NodeKind.InterfaceTypeDefinition:
        registerInterfacePlaceholder(registry, def);
        break;
      case NodeKind.UnionTypeDefinition:
        registerUnionPlaceholder(registry, def);
        break;
      case NodeKind.EnumTypeDefinition:
        registerEnumType(registry, def);
        break;
      case NodeKind.InputObjectTypeDefinition:
        registerInputObjectPlaceholder(registry, def);
        break;
    }
  }

  // Second pass: fill in fields (allows forward references)
  for (const def of document.definitions) {
    switch (def.kind) {
      case NodeKind.ObjectTypeDefinition:
        fillObjectFields(registry, def);
        break;
      case NodeKind.InterfaceTypeDefinition:
        fillInterfaceFields(registry, def);
        break;
      case NodeKind.UnionTypeDefinition:
        fillUnionTypes(registry, def);
        break;
      case NodeKind.InputObjectTypeDefinition:
        fillInputObjectFields(registry, def);
        break;
    }
  }

  // Determine root types
  let queryTypeName = "Query";
  let mutationTypeName = "Mutation";
  let subscriptionTypeName = "Subscription";

  for (const def of document.definitions) {
    if (def.kind === NodeKind.SchemaDefinition) {
      for (const opType of def.operationTypes) {
        switch (opType.operation) {
          case OperationType.Query:
            queryTypeName = opType.type.name.value;
            break;
          case OperationType.Mutation:
            mutationTypeName = opType.type.name.value;
            break;
          case OperationType.Subscription:
            subscriptionTypeName = opType.type.name.value;
            break;
        }
      }
    }
  }

  const queryType = registry.get(queryTypeName);
  const mutationType = registry.get(mutationTypeName);
  const subscriptionType = registry.get(subscriptionTypeName);

  const types = registry.getAll();

  return {
    queryType: queryType?.kind === "OBJECT" ? queryType : undefined,
    mutationType: mutationType?.kind === "OBJECT" ? mutationType : undefined,
    subscriptionType: subscriptionType?.kind === "OBJECT" ? subscriptionType : undefined,
    types,
    directives: [],
    getType(name: string) {
      return types.get(name);
    },
    getQueryType() {
      return this.queryType;
    },
    getMutationType() {
      return this.mutationType;
    },
    getSubscriptionType() {
      return this.subscriptionType;
    },
  };
}

// ─── Type registration helpers ────────────────────────────────────────────

function registerScalarType(registry: TypeRegistry, def: ScalarTypeDefinitionNode): void {
  if (BUILT_IN_SCALARS.has(def.name.value)) return;
  registry.register({
    kind: "SCALAR",
    name: def.name.value,
    description: def.description,
    serialize: (v) => v,
    parseValue: (v) => v,
    parseLiteral: () => undefined,
  });
}

function registerObjectTypePlaceholder(registry: TypeRegistry, def: ObjectTypeDefinitionNode): void {
  registry.register({
    kind: "OBJECT",
    name: def.name.value,
    description: def.description,
    fields: new Map(),
    interfaces: def.interfaces.map((i) => i.name.value),
  });
}

function registerInterfacePlaceholder(registry: TypeRegistry, def: InterfaceTypeDefinitionNode): void {
  registry.register({
    kind: "INTERFACE",
    name: def.name.value,
    description: def.description,
    fields: new Map(),
  });
}

function registerUnionPlaceholder(registry: TypeRegistry, def: UnionTypeDefinitionNode): void {
  registry.register({
    kind: "UNION",
    name: def.name.value,
    description: def.description,
    types: [],
  });
}

function registerEnumType(registry: TypeRegistry, def: EnumTypeDefinitionNode): void {
  const values = new Map<string, GraphQLEnumValue>();
  for (const val of def.values) {
    values.set(val.name.value, {
      name: val.name.value,
      value: val.name.value,
      description: val.description,
    });
  }
  registry.register({
    kind: "ENUM",
    name: def.name.value,
    description: def.description,
    values,
  });
}

function registerInputObjectPlaceholder(registry: TypeRegistry, def: InputObjectTypeDefinitionNode): void {
  registry.register({
    kind: "INPUT_OBJECT",
    name: def.name.value,
    description: def.description,
    fields: new Map(),
  });
}

// ─── Field filling helpers ────────────────────────────────────────────────

function fillObjectFields(registry: TypeRegistry, def: ObjectTypeDefinitionNode): void {
  const type = registry.get(def.name.value) as GraphQLObjectType;
  for (const fieldDef of def.fields) {
    type.fields.set(fieldDef.name.value, buildObjectField(registry, fieldDef));
  }
}

function fillInterfaceFields(registry: TypeRegistry, def: InterfaceTypeDefinitionNode): void {
  const type = registry.get(def.name.value) as GraphQLInterfaceType;
  for (const fieldDef of def.fields) {
    type.fields.set(fieldDef.name.value, buildObjectField(registry, fieldDef));
  }
}

function fillUnionTypes(registry: TypeRegistry, def: UnionTypeDefinitionNode): void {
  const type = registry.get(def.name.value) as GraphQLUnionType;
  type.types = def.types.map((t) => t.name.value);
}

function fillInputObjectFields(registry: TypeRegistry, def: InputObjectTypeDefinitionNode): void {
  const type = registry.get(def.name.value) as GraphQLInputObjectType;
  for (const fieldDef of def.fields) {
    type.fields.set(fieldDef.name.value, buildInputField(registry, fieldDef));
  }
}

function buildObjectField(registry: TypeRegistry, def: FieldDefinitionNode): GraphQLObjectField {
  const args: GraphQLArgument[] = def.arguments.map((arg) => ({
    name: arg.name.value,
    type: resolveType(registry, arg.type),
    defaultValue: arg.defaultValue ? valueLiteralToJs(arg.defaultValue) : undefined,
    description: arg.description,
  }));

  return {
    name: def.name.value,
    type: resolveType(registry, def.type),
    args,
    description: def.description,
  };
}

function buildInputField(registry: TypeRegistry, def: InputValueDefinitionNode): GraphQLInputField {
  return {
    name: def.name.value,
    type: resolveType(registry, def.type),
    defaultValue: def.defaultValue ? valueLiteralToJs(def.defaultValue) : undefined,
    description: def.description,
  };
}

function resolveType(registry: TypeRegistry, typeNode: TypeNode): GraphQLType {
  switch (typeNode.kind) {
    case NodeKind.NamedType: {
      const resolved = registry.get(typeNode.name.value);
      if (!resolved) {
        throw new SchemaError(`Unknown type: ${typeNode.name.value}`);
      }
      return resolved;
    }
    case NodeKind.ListType:
      return { kind: "LIST", ofType: resolveType(registry, typeNode.type) };
    case NodeKind.NonNullType:
      return {
        kind: "NON_NULL",
        ofType: resolveType(registry, typeNode.type) as GraphQLScalarType,
      };
  }
}

function valueLiteralToJs(ast: ValueNode): unknown {
  switch (ast.kind) {
    case NodeKind.IntValue: return parseInt(ast.value, 10);
    case NodeKind.FloatValue: return parseFloat(ast.value);
    case NodeKind.StringValue: return ast.value;
    case NodeKind.BooleanValue: return ast.value;
    case NodeKind.NullValue: return null;
    case NodeKind.EnumValue: return ast.value;
    case NodeKind.ListValue: return ast.values.map(valueLiteralToJs);
    case NodeKind.ObjectValue: {
      const obj: Record<string, unknown> = {};
      for (const field of ast.fields) {
        obj[field.name.value] = valueLiteralToJs(field.value);
      }
      return obj;
    }
    case NodeKind.Variable: return undefined;
  }
}

/**
 * Create a custom scalar type
 */
export function createScalarType(config: {
  name: string;
  description?: string;
  serialize: (value: unknown) => unknown;
  parseValue: (value: unknown) => unknown;
  parseLiteral: (ast: ValueNode) => unknown;
}): GraphQLScalarType {
  return {
    kind: "SCALAR",
    name: config.name,
    description: config.description,
    serialize: config.serialize,
    parseValue: config.parseValue,
    parseLiteral: config.parseLiteral,
  };
}

/**
 * Validate a schema for consistency
 */
export function validateSchema(schema: GraphQLSchema): string[] {
  const errors: string[] = [];

  if (!schema.queryType) {
    errors.push("Schema must have a Query type");
  }

  // Validate object types
  for (const [name, type] of schema.types) {
    if (type.kind === "OBJECT") {
      // Check interface implementations
      for (const ifaceName of type.interfaces) {
        const iface = schema.getType(ifaceName);
        if (!iface) {
          errors.push(`Type "${name}" implements unknown interface "${ifaceName}"`);
        } else if (iface.kind !== "INTERFACE") {
          errors.push(`Type "${name}" implements "${ifaceName}" which is not an interface`);
        } else {
          // Check all interface fields are implemented
          for (const [fieldName] of iface.fields) {
            if (!type.fields.has(fieldName)) {
              errors.push(`Type "${name}" missing field "${fieldName}" required by interface "${ifaceName}"`);
            }
          }
        }
      }
    }

    if (type.kind === "UNION") {
      if (type.types.length === 0) {
        errors.push(`Union "${name}" must have at least one member type`);
      }
      for (const memberName of type.types) {
        const member = schema.getType(memberName);
        if (!member) {
          errors.push(`Union "${name}" references unknown type "${memberName}"`);
        } else if (member.kind !== "OBJECT") {
          errors.push(`Union "${name}" member "${memberName}" must be an object type`);
        }
      }
    }
  }

  return errors;
}
