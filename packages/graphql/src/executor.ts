// @nexus/graphql - Query executor

import { GraphQLExecutionError } from "./errors.js";
import {
  type DocumentNode,
  type ExecutionContext,
  type ExecutionResult,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLObjectField,
  type GraphQLObjectType,
  type GraphQLSchema,
  type GraphQLType,
  type ResolveInfo,
  type ResponsePath,
  type SelectionNode,
  type ValueNode,
  type VariableDefinitionNode,
  NodeKind,
  OperationType,
} from "./types.js";

// ─── Execute ──────────────────────────────────────────────────────────────

export interface ExecuteOptions {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Record<string, unknown>;
  operationName?: string;
  maxDepth?: number;
  maxComplexity?: number;
}

export async function execute(options: ExecuteOptions): Promise<ExecutionResult> {
  const { schema, document, rootValue, contextValue, variableValues, operationName, maxDepth, maxComplexity } = options;

  // Find the operation
  const operations = document.definitions.filter(
    (def): def is typeof def & { kind: typeof NodeKind.OperationDefinition } =>
      def.kind === NodeKind.OperationDefinition,
  );

  if (operations.length === 0) {
    return { errors: [{ message: "Must provide an operation" }] };
  }

  let operation = operations[0];
  if (operationName) {
    const found = operations.find((op) => op.name?.value === operationName);
    if (!found) {
      return { errors: [{ message: `Unknown operation named "${operationName}"` }] };
    }
    operation = found;
  } else if (operations.length > 1) {
    return { errors: [{ message: "Must provide operation name when multiple operations exist" }] };
  }

  // Collect fragments
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const def of document.definitions) {
    if (def.kind === NodeKind.FragmentDefinition) {
      fragments.set(def.name.value, def);
    }
  }

  // Coerce variable values
  const coercedVariables = coerceVariableValues(
    schema,
    operation.variableDefinitions,
    variableValues ?? {},
  );

  const ctx: ExecutionContext = {
    schema,
    fragments,
    rootValue: rootValue ?? {},
    contextValue: contextValue ?? {},
    operation,
    variableValues: coercedVariables,
    errors: [],
    maxDepth,
    maxComplexity,
  };

  // Get root type
  let rootType: GraphQLObjectType | undefined;
  switch (operation.operation) {
    case OperationType.Query:
      rootType = schema.getQueryType();
      break;
    case OperationType.Mutation:
      rootType = schema.getMutationType();
      break;
    case OperationType.Subscription:
      rootType = schema.getSubscriptionType();
      break;
  }

  if (!rootType) {
    return {
      errors: [{ message: `Schema does not define a ${operation.operation} type` }],
    };
  }

  // Check depth
  if (maxDepth !== undefined) {
    const depth = calculateDepth(operation.selectionSet.selections, fragments);
    if (depth > maxDepth) {
      return {
        errors: [{ message: `Query depth ${depth} exceeds maximum allowed depth ${maxDepth}` }],
      };
    }
  }

  // Check complexity
  if (maxComplexity !== undefined) {
    const complexity = calculateComplexity(operation.selectionSet.selections, fragments);
    if (complexity > maxComplexity) {
      return {
        errors: [{ message: `Query complexity ${complexity} exceeds maximum allowed complexity ${maxComplexity}` }],
      };
    }
  }

  // Execute
  const data = await executeSelectionSet(
    ctx,
    operation.selectionSet.selections,
    rootType,
    rootValue ?? {},
    undefined,
    0,
  );

  const result: ExecutionResult = {};
  if (data !== undefined) {
    result.data = data as Record<string, unknown>;
  }
  if (ctx.errors.length > 0) {
    result.errors = ctx.errors;
  }
  return result;
}

// ─── Selection Set Execution ──────────────────────────────────────────────

async function executeSelectionSet(
  ctx: ExecutionContext,
  selections: readonly SelectionNode[],
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: ResponsePath | undefined,
  depth: number,
): Promise<Record<string, unknown> | null> {
  const result: Record<string, unknown> = {};
  const fields = collectFields(ctx, selections, parentType);

  for (const [responseKey, fieldNodes] of fields) {
    const fieldNode = fieldNodes[0];
    const fieldName = fieldNode.name.value;

    // Introspection __typename
    if (fieldName === "__typename") {
      result[responseKey] = parentType.name;
      continue;
    }

    const fieldDef = parentType.fields.get(fieldName);
    if (!fieldDef) {
      continue; // validation should have caught this
    }

    const fieldPath: ResponsePath = {
      prev: path,
      key: responseKey,
      typename: parentType.name,
    };

    const info: ResolveInfo = {
      fieldName,
      fieldNodes,
      returnType: fieldDef.type,
      parentType,
      path: fieldPath,
      schema: ctx.schema,
      fragments: ctx.fragments,
      rootValue: ctx.rootValue,
      operation: ctx.operation,
      variableValues: ctx.variableValues,
    };

    try {
      const resolvedValue = await resolveField(
        ctx,
        fieldDef,
        fieldNodes,
        sourceValue,
        info,
      );

      result[responseKey] = await completeValue(
        ctx,
        fieldDef.type,
        fieldNodes,
        resolvedValue,
        fieldPath,
        depth + 1,
      );
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      ctx.errors.push({
        message: errMessage,
        path: pathToArray(fieldPath),
      });
      result[responseKey] = null;
    }
  }

  return result;
}

// ─── Field Resolution ─────────────────────────────────────────────────────

async function resolveField(
  ctx: ExecutionContext,
  fieldDef: GraphQLObjectField,
  fieldNodes: FieldNode[],
  sourceValue: unknown,
  info: ResolveInfo,
): Promise<unknown> {
  const resolver = fieldDef.resolve;
  const args = coerceArgumentValues(fieldDef, fieldNodes[0], ctx.variableValues);

  if (resolver) {
    return resolver(sourceValue, args, ctx.contextValue, info);
  }

  // Default field resolver
  return defaultFieldResolver(sourceValue, args, ctx.contextValue, info);
}

function defaultFieldResolver(
  source: unknown,
  _args: Record<string, unknown>,
  _context: unknown,
  info: ResolveInfo,
): unknown {
  if (source !== null && source !== undefined && typeof source === "object") {
    const obj = source as Record<string, unknown>;
    const value = obj[info.fieldName];
    if (typeof value === "function") {
      return value.call(source);
    }
    return value;
  }
  return undefined;
}

// ─── Value Completion ─────────────────────────────────────────────────────

async function completeValue(
  ctx: ExecutionContext,
  returnType: GraphQLType,
  fieldNodes: FieldNode[],
  result: unknown,
  path: ResponsePath,
  depth: number,
): Promise<unknown> {
  // NonNull handling
  if (returnType.kind === "NON_NULL") {
    const completed = await completeValue(ctx, returnType.ofType, fieldNodes, result, path, depth);
    if (completed === null || completed === undefined) {
      throw new GraphQLExecutionError(
        `Cannot return null for non-nullable field`,
        pathToArray(path),
      );
    }
    return completed;
  }

  // Null propagation
  if (result === null || result === undefined) {
    return null;
  }

  // List handling
  if (returnType.kind === "LIST") {
    if (!Array.isArray(result)) {
      throw new GraphQLExecutionError(
        `Expected Iterable, got ${typeof result}`,
        pathToArray(path),
      );
    }
    const completedItems: unknown[] = [];
    for (let i = 0; i < result.length; i++) {
      const itemPath: ResponsePath = { prev: path, key: i };
      completedItems.push(
        await completeValue(ctx, returnType.ofType, fieldNodes, result[i], itemPath, depth),
      );
    }
    return completedItems;
  }

  // Scalar/Enum
  if (returnType.kind === "SCALAR") {
    return returnType.serialize(result);
  }

  if (returnType.kind === "ENUM") {
    const serialized = String(result);
    if (!returnType.values.has(serialized)) {
      throw new GraphQLExecutionError(
        `Enum "${returnType.name}" does not contain value "${serialized}"`,
        pathToArray(path),
      );
    }
    return serialized;
  }

  // Object
  if (returnType.kind === "OBJECT") {
    const selectionSet = fieldNodes[0].selectionSet;
    if (!selectionSet) return {};
    return executeSelectionSet(ctx, selectionSet.selections, returnType, result, path, depth);
  }

  // Interface/Union - resolve abstract type
  if (returnType.kind === "INTERFACE" || returnType.kind === "UNION") {
    const resolvedTypeName = await resolveAbstractType(ctx, returnType, result);
    const resolvedType = ctx.schema.getType(resolvedTypeName);
    if (!resolvedType || resolvedType.kind !== "OBJECT") {
      throw new GraphQLExecutionError(
        `Abstract type "${returnType.name}" resolved to invalid type "${resolvedTypeName}"`,
        pathToArray(path),
      );
    }
    const selectionSet = fieldNodes[0].selectionSet;
    if (!selectionSet) return {};
    return executeSelectionSet(ctx, selectionSet.selections, resolvedType, result, path, depth);
  }

  return result;
}

async function resolveAbstractType(
  ctx: ExecutionContext,
  abstractType: { kind: "INTERFACE" | "UNION"; name: string; resolveType?: (value: unknown, context: unknown) => string | Promise<string> },
  value: unknown,
): Promise<string> {
  if (abstractType.resolveType) {
    return abstractType.resolveType(value, ctx.contextValue);
  }

  // Try __typename
  if (value !== null && typeof value === "object" && "__typename" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).__typename);
  }

  // Try isTypeOf on all possible types
  if (abstractType.kind === "UNION") {
    const unionType = abstractType as { types: string[] } & typeof abstractType;
    for (const typeName of unionType.types) {
      const type = ctx.schema.getType(typeName);
      if (type?.kind === "OBJECT" && type.isTypeOf) {
        if (await type.isTypeOf(value, ctx.contextValue)) {
          return typeName;
        }
      }
    }
  }

  throw new GraphQLExecutionError(
    `Cannot determine type of abstract type "${abstractType.name}"`,
  );
}

// ─── Field Collection ─────────────────────────────────────────────────────

function collectFields(
  ctx: ExecutionContext,
  selections: readonly SelectionNode[],
  parentType: GraphQLObjectType,
): Map<string, FieldNode[]> {
  const fields = new Map<string, FieldNode[]>();

  for (const selection of selections) {
    if (!shouldInclude(selection, ctx.variableValues)) {
      continue;
    }

    switch (selection.kind) {
      case NodeKind.Field: {
        const responseKey = selection.alias?.value ?? selection.name.value;
        const existing = fields.get(responseKey);
        if (existing) {
          existing.push(selection);
        } else {
          fields.set(responseKey, [selection]);
        }
        break;
      }
      case NodeKind.FragmentSpread: {
        const fragName = selection.name.value;
        const fragment = ctx.fragments.get(fragName);
        if (fragment && doesFragmentApply(fragment.typeCondition.name.value, parentType, ctx.schema)) {
          const fragFields = collectFields(ctx, fragment.selectionSet.selections, parentType);
          for (const [key, nodes] of fragFields) {
            const existing = fields.get(key);
            if (existing) {
              existing.push(...nodes);
            } else {
              fields.set(key, nodes);
            }
          }
        }
        break;
      }
      case NodeKind.InlineFragment: {
        if (
          selection.typeCondition &&
          !doesFragmentApply(selection.typeCondition.name.value, parentType, ctx.schema)
        ) {
          break;
        }
        const inlineFields = collectFields(ctx, selection.selectionSet.selections, parentType);
        for (const [key, nodes] of inlineFields) {
          const existing = fields.get(key);
          if (existing) {
            existing.push(...nodes);
          } else {
            fields.set(key, nodes);
          }
        }
        break;
      }
    }
  }

  return fields;
}

function doesFragmentApply(
  typeName: string,
  objectType: GraphQLObjectType,
  schema: GraphQLSchema,
): boolean {
  if (typeName === objectType.name) return true;
  // Check if typeName is an interface that objectType implements
  if (objectType.interfaces.includes(typeName)) return true;
  // Check if typeName is a union that includes objectType
  const type = schema.getType(typeName);
  if (type?.kind === "UNION" && type.types.includes(objectType.name)) return true;
  return false;
}

function shouldInclude(
  selection: SelectionNode,
  variables: Record<string, unknown>,
): boolean {
  const directives = "directives" in selection ? selection.directives : [];
  for (const directive of directives) {
    if (directive.name.value === "skip") {
      const ifArg = directive.arguments.find((a) => a.name.value === "if");
      if (ifArg && resolveValueNode(ifArg.value, variables) === true) {
        return false;
      }
    }
    if (directive.name.value === "include") {
      const ifArg = directive.arguments.find((a) => a.name.value === "if");
      if (ifArg && resolveValueNode(ifArg.value, variables) === false) {
        return false;
      }
    }
  }
  return true;
}

// ─── Arguments ────────────────────────────────────────────────────────────

function coerceArgumentValues(
  fieldDef: GraphQLObjectField,
  fieldNode: FieldNode,
  variableValues: Record<string, unknown>,
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};

  for (const argDef of fieldDef.args) {
    const argNode = fieldNode.arguments.find((a) => a.name.value === argDef.name);
    if (argNode) {
      coerced[argDef.name] = resolveValueNode(argNode.value, variableValues);
    } else if (argDef.defaultValue !== undefined) {
      coerced[argDef.name] = argDef.defaultValue;
    }
  }

  return coerced;
}

function coerceVariableValues(
  _schema: GraphQLSchema,
  varDefs: VariableDefinitionNode[],
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const varDef of varDefs) {
    const varName = varDef.variable.name.value;
    if (varName in inputs) {
      coerced[varName] = inputs[varName];
    } else if (varDef.defaultValue) {
      coerced[varName] = resolveValueNode(varDef.defaultValue, {});
    }
  }
  return coerced;
}

function resolveValueNode(
  node: ValueNode,
  variables: Record<string, unknown>,
): unknown {
  switch (node.kind) {
    case NodeKind.Variable:
      return variables[node.name.value];
    case NodeKind.IntValue:
      return parseInt(node.value, 10);
    case NodeKind.FloatValue:
      return parseFloat(node.value);
    case NodeKind.StringValue:
      return node.value;
    case NodeKind.BooleanValue:
      return node.value;
    case NodeKind.NullValue:
      return null;
    case NodeKind.EnumValue:
      return node.value;
    case NodeKind.ListValue:
      return node.values.map((v) => resolveValueNode(v, variables));
    case NodeKind.ObjectValue: {
      const obj: Record<string, unknown> = {};
      for (const field of node.fields) {
        obj[field.name.value] = resolveValueNode(field.value, variables);
      }
      return obj;
    }
  }
}

// ─── Depth & Complexity Analysis ──────────────────────────────────────────

export function calculateDepth(
  selections: readonly SelectionNode[],
  fragments: Map<string, FragmentDefinitionNode>,
  currentDepth = 0,
): number {
  let maxDepth = currentDepth;

  for (const selection of selections) {
    if (selection.kind === NodeKind.Field) {
      if (selection.selectionSet) {
        const d = calculateDepth(selection.selectionSet.selections, fragments, currentDepth + 1);
        if (d > maxDepth) maxDepth = d;
      }
    } else if (selection.kind === NodeKind.FragmentSpread) {
      const frag = fragments.get(selection.name.value);
      if (frag) {
        const d = calculateDepth(frag.selectionSet.selections, fragments, currentDepth);
        if (d > maxDepth) maxDepth = d;
      }
    } else if (selection.kind === NodeKind.InlineFragment) {
      const d = calculateDepth(selection.selectionSet.selections, fragments, currentDepth);
      if (d > maxDepth) maxDepth = d;
    }
  }

  return maxDepth;
}

export function calculateComplexity(
  selections: readonly SelectionNode[],
  fragments: Map<string, FragmentDefinitionNode>,
): number {
  let complexity = 0;

  for (const selection of selections) {
    if (selection.kind === NodeKind.Field) {
      complexity += 1;
      if (selection.selectionSet) {
        complexity += calculateComplexity(selection.selectionSet.selections, fragments);
      }
    } else if (selection.kind === NodeKind.FragmentSpread) {
      const frag = fragments.get(selection.name.value);
      if (frag) {
        complexity += calculateComplexity(frag.selectionSet.selections, fragments);
      }
    } else if (selection.kind === NodeKind.InlineFragment) {
      complexity += calculateComplexity(selection.selectionSet.selections, fragments);
    }
  }

  return complexity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function pathToArray(path: ResponsePath | undefined): Array<string | number> {
  const result: Array<string | number> = [];
  let current = path;
  while (current) {
    result.unshift(current.key);
    current = current.prev;
  }
  return result;
}
