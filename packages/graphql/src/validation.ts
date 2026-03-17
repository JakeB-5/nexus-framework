// @nexus/graphql - Query validation

import { GraphQLValidationError } from "./errors.js";
import {
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLObjectType,
  type GraphQLSchema,
  type GraphQLType,
  type OperationDefinitionNode,
  type SelectionNode,
  type TypeNode,
  NodeKind,
  OperationType,
} from "./types.js";

export interface ValidationContext {
  schema: GraphQLSchema;
  document: DocumentNode;
  errors: GraphQLValidationError[];
  fragments: Map<string, FragmentDefinitionNode>;
  usedFragments: Set<string>;
  usedVariables: Set<string>;
}

/**
 * Validate a document against a schema
 */
export function validate(
  schema: GraphQLSchema,
  document: DocumentNode,
): GraphQLValidationError[] {
  const fragments = new Map<string, FragmentDefinitionNode>();
  const operations: OperationDefinitionNode[] = [];

  // Collect fragments and operations
  for (const def of document.definitions) {
    if (def.kind === NodeKind.FragmentDefinition) {
      if (fragments.has(def.name.value)) {
        return [new GraphQLValidationError(`Duplicate fragment "${def.name.value}"`)];
      }
      fragments.set(def.name.value, def);
    } else if (def.kind === NodeKind.OperationDefinition) {
      operations.push(def);
    }
  }

  const ctx: ValidationContext = {
    schema,
    document,
    errors: [],
    fragments,
    usedFragments: new Set(),
    usedVariables: new Set(),
  };

  // Validate unique operation names
  validateUniqueOperationNames(ctx, operations);

  // Validate each operation
  for (const operation of operations) {
    validateOperation(ctx, operation);
  }

  // Validate no unused fragments
  validateNoUnusedFragments(ctx);

  return ctx.errors;
}

function validateUniqueOperationNames(
  ctx: ValidationContext,
  operations: OperationDefinitionNode[],
): void {
  const names = new Set<string>();
  for (const op of operations) {
    if (op.name) {
      if (names.has(op.name.value)) {
        ctx.errors.push(
          new GraphQLValidationError(`Duplicate operation name "${op.name.value}"`),
        );
      }
      names.add(op.name.value);
    }
  }
}

function validateOperation(
  ctx: ValidationContext,
  operation: OperationDefinitionNode,
): void {
  // Get root type
  let rootType: GraphQLObjectType | undefined;
  switch (operation.operation) {
    case OperationType.Query:
      rootType = ctx.schema.getQueryType();
      break;
    case OperationType.Mutation:
      rootType = ctx.schema.getMutationType();
      break;
    case OperationType.Subscription:
      rootType = ctx.schema.getSubscriptionType();
      break;
  }

  if (!rootType) {
    ctx.errors.push(
      new GraphQLValidationError(
        `Schema does not define a ${operation.operation} type`,
      ),
    );
    return;
  }

  // Track variables for this operation
  const definedVariables = new Set<string>();
  const usedVarsInOp = new Set<string>();

  for (const varDef of operation.variableDefinitions) {
    const varName = varDef.variable.name.value;
    if (definedVariables.has(varName)) {
      ctx.errors.push(
        new GraphQLValidationError(`Duplicate variable "$${varName}"`),
      );
    }
    definedVariables.add(varName);

    // Validate variable type exists
    validateTypeReference(ctx, varDef.type);
  }

  // Validate selection set
  validateSelectionSet(ctx, operation.selectionSet.selections, rootType, usedVarsInOp);

  // Validate subscription has single root field
  if (operation.operation === OperationType.Subscription) {
    const rootFields = operation.selectionSet.selections.filter(
      (s) => s.kind === NodeKind.Field,
    );
    if (rootFields.length !== 1) {
      ctx.errors.push(
        new GraphQLValidationError(
          "Subscription must have exactly one root field",
        ),
      );
    }
  }

  // Validate no unused variables
  for (const varName of definedVariables) {
    if (!usedVarsInOp.has(varName)) {
      ctx.errors.push(
        new GraphQLValidationError(`Variable "$${varName}" is not used`),
      );
    }
  }
}

function validateSelectionSet(
  ctx: ValidationContext,
  selections: readonly SelectionNode[],
  parentType: GraphQLObjectType,
  usedVars: Set<string>,
): void {
  for (const selection of selections) {
    switch (selection.kind) {
      case NodeKind.Field:
        validateField(ctx, selection, parentType, usedVars);
        break;
      case NodeKind.FragmentSpread: {
        const fragName = selection.name.value;
        ctx.usedFragments.add(fragName);
        const fragment = ctx.fragments.get(fragName);
        if (!fragment) {
          ctx.errors.push(
            new GraphQLValidationError(`Unknown fragment "${fragName}"`),
          );
        } else {
          // Validate fragment type condition
          const fragType = ctx.schema.getType(fragment.typeCondition.name.value);
          if (!fragType) {
            ctx.errors.push(
              new GraphQLValidationError(
                `Fragment "${fragName}" references unknown type "${fragment.typeCondition.name.value}"`,
              ),
            );
          } else if (fragType.kind === "OBJECT") {
            validateSelectionSet(ctx, fragment.selectionSet.selections, fragType, usedVars);
          }
        }
        break;
      }
      case NodeKind.InlineFragment: {
        if (selection.typeCondition) {
          const typeName = selection.typeCondition.name.value;
          const type = ctx.schema.getType(typeName);
          if (!type) {
            ctx.errors.push(
              new GraphQLValidationError(`Unknown type "${typeName}" in inline fragment`),
            );
          } else if (type.kind === "OBJECT") {
            validateSelectionSet(ctx, selection.selectionSet.selections, type, usedVars);
          }
        } else {
          validateSelectionSet(ctx, selection.selectionSet.selections, parentType, usedVars);
        }
        break;
      }
    }
  }
}

function validateField(
  ctx: ValidationContext,
  field: FieldNode,
  parentType: GraphQLObjectType,
  usedVars: Set<string>,
): void {
  const fieldName = field.name.value;

  // __typename is always valid
  if (fieldName === "__typename") return;

  const fieldDef = parentType.fields.get(fieldName);
  if (!fieldDef) {
    ctx.errors.push(
      new GraphQLValidationError(
        `Field "${fieldName}" does not exist on type "${parentType.name}"`,
      ),
    );
    return;
  }

  // Validate arguments
  const definedArgs = new Set(fieldDef.args.map((a) => a.name));
  for (const arg of field.arguments) {
    if (!definedArgs.has(arg.name.value)) {
      ctx.errors.push(
        new GraphQLValidationError(
          `Unknown argument "${arg.name.value}" on field "${parentType.name}.${fieldName}"`,
        ),
      );
    }
    // Track variable usage in arguments
    collectVariableUsage(arg.value, usedVars);
  }

  // If field returns object type, must have selection set
  const namedType = getNamedType(fieldDef.type);
  if (namedType && (namedType.kind === "OBJECT" || namedType.kind === "INTERFACE" || namedType.kind === "UNION")) {
    if (!field.selectionSet || field.selectionSet.selections.length === 0) {
      ctx.errors.push(
        new GraphQLValidationError(
          `Field "${fieldName}" must have a selection set (returns "${namedType.name}")`,
        ),
      );
    } else if (namedType.kind === "OBJECT") {
      validateSelectionSet(ctx, field.selectionSet.selections, namedType, usedVars);
    }
  } else if (field.selectionSet) {
    ctx.errors.push(
      new GraphQLValidationError(
        `Field "${fieldName}" must not have a selection set (returns a scalar or enum)`,
      ),
    );
  }
}

function validateTypeReference(ctx: ValidationContext, typeNode: TypeNode): void {
  switch (typeNode.kind) {
    case NodeKind.NamedType: {
      const typeName = typeNode.name.value;
      if (!ctx.schema.getType(typeName)) {
        ctx.errors.push(
          new GraphQLValidationError(`Unknown type "${typeName}"`),
        );
      }
      break;
    }
    case NodeKind.ListType:
      validateTypeReference(ctx, typeNode.type);
      break;
    case NodeKind.NonNullType:
      validateTypeReference(ctx, typeNode.type);
      break;
  }
}

function validateNoUnusedFragments(ctx: ValidationContext): void {
  for (const [name] of ctx.fragments) {
    if (!ctx.usedFragments.has(name)) {
      ctx.errors.push(
        new GraphQLValidationError(`Fragment "${name}" is not used`),
      );
    }
  }
}

function collectVariableUsage(
  node: { kind: string; name?: { value: string }; value?: unknown; values?: unknown[]; fields?: Array<{ value: unknown }> },
  usedVars: Set<string>,
): void {
  if (node.kind === NodeKind.Variable && node.name) {
    usedVars.add(node.name.value);
  } else if (node.kind === NodeKind.ListValue && Array.isArray(node.values)) {
    for (const v of node.values) {
      collectVariableUsage(v as typeof node, usedVars);
    }
  } else if (node.kind === NodeKind.ObjectValue && Array.isArray(node.fields)) {
    for (const f of node.fields) {
      collectVariableUsage(f.value as typeof node, usedVars);
    }
  }
}

function getNamedType(type: GraphQLType): GraphQLType | undefined {
  if (type.kind === "NON_NULL") return getNamedType(type.ofType);
  if (type.kind === "LIST") return getNamedType(type.ofType);
  return type;
}
