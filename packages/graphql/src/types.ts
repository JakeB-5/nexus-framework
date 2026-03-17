// @nexus/graphql - All GraphQL type definitions

// ─── AST Node Types ───────────────────────────────────────────────────────

export enum NodeKind {
  Document = "Document",
  OperationDefinition = "OperationDefinition",
  VariableDefinition = "VariableDefinition",
  Variable = "Variable",
  SelectionSet = "SelectionSet",
  Field = "Field",
  Argument = "Argument",
  FragmentSpread = "FragmentSpread",
  InlineFragment = "InlineFragment",
  FragmentDefinition = "FragmentDefinition",
  IntValue = "IntValue",
  FloatValue = "FloatValue",
  StringValue = "StringValue",
  BooleanValue = "BooleanValue",
  NullValue = "NullValue",
  EnumValue = "EnumValue",
  ListValue = "ListValue",
  ObjectValue = "ObjectValue",
  ObjectField = "ObjectField",
  Directive = "Directive",
  NamedType = "NamedType",
  ListType = "ListType",
  NonNullType = "NonNullType",
  // SDL nodes
  SchemaDefinition = "SchemaDefinition",
  OperationTypeDefinition = "OperationTypeDefinition",
  ScalarTypeDefinition = "ScalarTypeDefinition",
  ObjectTypeDefinition = "ObjectTypeDefinition",
  FieldDefinition = "FieldDefinition",
  InputValueDefinition = "InputValueDefinition",
  InterfaceTypeDefinition = "InterfaceTypeDefinition",
  UnionTypeDefinition = "UnionTypeDefinition",
  EnumTypeDefinition = "EnumTypeDefinition",
  EnumValueDefinition = "EnumValueDefinition",
  InputObjectTypeDefinition = "InputObjectTypeDefinition",
  DirectiveDefinition = "DirectiveDefinition",
}

export enum OperationType {
  Query = "query",
  Mutation = "mutation",
  Subscription = "subscription",
}

export interface Location {
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface NameNode {
  value: string;
  loc?: Location;
}

// ─── Type Reference Nodes ─────────────────────────────────────────────────

export interface NamedTypeNode {
  kind: NodeKind.NamedType;
  name: NameNode;
}

export interface ListTypeNode {
  kind: NodeKind.ListType;
  type: TypeNode;
}

export interface NonNullTypeNode {
  kind: NodeKind.NonNullType;
  type: NamedTypeNode | ListTypeNode;
}

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

// ─── Value Nodes ──────────────────────────────────────────────────────────

export interface IntValueNode {
  kind: NodeKind.IntValue;
  value: string;
}

export interface FloatValueNode {
  kind: NodeKind.FloatValue;
  value: string;
}

export interface StringValueNode {
  kind: NodeKind.StringValue;
  value: string;
}

export interface BooleanValueNode {
  kind: NodeKind.BooleanValue;
  value: boolean;
}

export interface NullValueNode {
  kind: NodeKind.NullValue;
}

export interface EnumValueNode {
  kind: NodeKind.EnumValue;
  value: string;
}

export interface ListValueNode {
  kind: NodeKind.ListValue;
  values: ValueNode[];
}

export interface ObjectFieldNode {
  kind: NodeKind.ObjectField;
  name: NameNode;
  value: ValueNode;
}

export interface ObjectValueNode {
  kind: NodeKind.ObjectValue;
  fields: ObjectFieldNode[];
}

export type ValueNode =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ListValueNode
  | ObjectValueNode
  | VariableNode;

// ─── Query Nodes ──────────────────────────────────────────────────────────

export interface VariableNode {
  kind: NodeKind.Variable;
  name: NameNode;
}

export interface ArgumentNode {
  kind: NodeKind.Argument;
  name: NameNode;
  value: ValueNode;
}

export interface DirectiveNode {
  kind: NodeKind.Directive;
  name: NameNode;
  arguments: ArgumentNode[];
}

export interface FieldNode {
  kind: NodeKind.Field;
  alias?: NameNode;
  name: NameNode;
  arguments: ArgumentNode[];
  directives: DirectiveNode[];
  selectionSet?: SelectionSetNode;
}

export interface FragmentSpreadNode {
  kind: NodeKind.FragmentSpread;
  name: NameNode;
  directives: DirectiveNode[];
}

export interface InlineFragmentNode {
  kind: NodeKind.InlineFragment;
  typeCondition?: NamedTypeNode;
  directives: DirectiveNode[];
  selectionSet: SelectionSetNode;
}

export type SelectionNode = FieldNode | FragmentSpreadNode | InlineFragmentNode;

export interface SelectionSetNode {
  kind: NodeKind.SelectionSet;
  selections: SelectionNode[];
}

export interface VariableDefinitionNode {
  kind: NodeKind.VariableDefinition;
  variable: VariableNode;
  type: TypeNode;
  defaultValue?: ValueNode;
}

export interface OperationDefinitionNode {
  kind: NodeKind.OperationDefinition;
  operation: OperationType;
  name?: NameNode;
  variableDefinitions: VariableDefinitionNode[];
  directives: DirectiveNode[];
  selectionSet: SelectionSetNode;
}

export interface FragmentDefinitionNode {
  kind: NodeKind.FragmentDefinition;
  name: NameNode;
  typeCondition: NamedTypeNode;
  directives: DirectiveNode[];
  selectionSet: SelectionSetNode;
}

export interface DocumentNode {
  kind: NodeKind.Document;
  definitions: Array<OperationDefinitionNode | FragmentDefinitionNode | TypeDefinitionNode | SchemaDefinitionNode>;
}

// ─── SDL Nodes ────────────────────────────────────────────────────────────

export interface InputValueDefinitionNode {
  kind: NodeKind.InputValueDefinition;
  name: NameNode;
  type: TypeNode;
  defaultValue?: ValueNode;
  description?: string;
}

export interface FieldDefinitionNode {
  kind: NodeKind.FieldDefinition;
  name: NameNode;
  arguments: InputValueDefinitionNode[];
  type: TypeNode;
  description?: string;
}

export interface OperationTypeDefinitionNode {
  kind: NodeKind.OperationTypeDefinition;
  operation: OperationType;
  type: NamedTypeNode;
}

export interface SchemaDefinitionNode {
  kind: NodeKind.SchemaDefinition;
  operationTypes: OperationTypeDefinitionNode[];
}

export interface ScalarTypeDefinitionNode {
  kind: NodeKind.ScalarTypeDefinition;
  name: NameNode;
  description?: string;
}

export interface ObjectTypeDefinitionNode {
  kind: NodeKind.ObjectTypeDefinition;
  name: NameNode;
  interfaces: NamedTypeNode[];
  fields: FieldDefinitionNode[];
  description?: string;
}

export interface InterfaceTypeDefinitionNode {
  kind: NodeKind.InterfaceTypeDefinition;
  name: NameNode;
  fields: FieldDefinitionNode[];
  description?: string;
}

export interface UnionTypeDefinitionNode {
  kind: NodeKind.UnionTypeDefinition;
  name: NameNode;
  types: NamedTypeNode[];
  description?: string;
}

export interface EnumValueDefinitionNode {
  kind: NodeKind.EnumValueDefinition;
  name: NameNode;
  description?: string;
}

export interface EnumTypeDefinitionNode {
  kind: NodeKind.EnumTypeDefinition;
  name: NameNode;
  values: EnumValueDefinitionNode[];
  description?: string;
}

export interface InputObjectTypeDefinitionNode {
  kind: NodeKind.InputObjectTypeDefinition;
  name: NameNode;
  fields: InputValueDefinitionNode[];
  description?: string;
}

export type TypeDefinitionNode =
  | ScalarTypeDefinitionNode
  | ObjectTypeDefinitionNode
  | InterfaceTypeDefinitionNode
  | UnionTypeDefinitionNode
  | EnumTypeDefinitionNode
  | InputObjectTypeDefinitionNode;

// ─── Schema Types ─────────────────────────────────────────────────────────

export interface GraphQLScalarType {
  kind: "SCALAR";
  name: string;
  description?: string;
  serialize: (value: unknown) => unknown;
  parseValue: (value: unknown) => unknown;
  parseLiteral: (ast: ValueNode) => unknown;
}

export interface GraphQLObjectField {
  name: string;
  type: GraphQLType;
  args: GraphQLArgument[];
  resolve?: ResolverFn;
  description?: string;
}

export interface GraphQLArgument {
  name: string;
  type: GraphQLType;
  defaultValue?: unknown;
  description?: string;
}

export interface GraphQLObjectType {
  kind: "OBJECT";
  name: string;
  description?: string;
  fields: Map<string, GraphQLObjectField>;
  interfaces: string[];
  isTypeOf?: (value: unknown, context: unknown) => boolean | Promise<boolean>;
}

export interface GraphQLInterfaceType {
  kind: "INTERFACE";
  name: string;
  description?: string;
  fields: Map<string, GraphQLObjectField>;
  resolveType?: (value: unknown, context: unknown) => string | Promise<string>;
}

export interface GraphQLUnionType {
  kind: "UNION";
  name: string;
  description?: string;
  types: string[];
  resolveType?: (value: unknown, context: unknown) => string | Promise<string>;
}

export interface GraphQLEnumValue {
  name: string;
  value: unknown;
  description?: string;
}

export interface GraphQLEnumType {
  kind: "ENUM";
  name: string;
  description?: string;
  values: Map<string, GraphQLEnumValue>;
}

export interface GraphQLInputField {
  name: string;
  type: GraphQLType;
  defaultValue?: unknown;
  description?: string;
}

export interface GraphQLInputObjectType {
  kind: "INPUT_OBJECT";
  name: string;
  description?: string;
  fields: Map<string, GraphQLInputField>;
}

export interface GraphQLListType {
  kind: "LIST";
  ofType: GraphQLType;
}

export interface GraphQLNonNullType {
  kind: "NON_NULL";
  ofType: GraphQLScalarType | GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType | GraphQLEnumType | GraphQLInputObjectType | GraphQLListType;
}

export type GraphQLNamedType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType;

export type GraphQLType =
  | GraphQLNamedType
  | GraphQLListType
  | GraphQLNonNullType;

// ─── Schema ───────────────────────────────────────────────────────────────

export interface GraphQLSchema {
  queryType?: GraphQLObjectType;
  mutationType?: GraphQLObjectType;
  subscriptionType?: GraphQLObjectType;
  types: Map<string, GraphQLNamedType>;
  directives: GraphQLDirective[];
  getType(name: string): GraphQLNamedType | undefined;
  getQueryType(): GraphQLObjectType | undefined;
  getMutationType(): GraphQLObjectType | undefined;
  getSubscriptionType(): GraphQLObjectType | undefined;
}

export interface GraphQLDirective {
  name: string;
  description?: string;
  locations: string[];
  args: GraphQLArgument[];
}

// ─── Execution Types ──────────────────────────────────────────────────────

export type ResolverFn<TResult = unknown, TParent = unknown, TContext = unknown, TArgs = Record<string, unknown>> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: ResolveInfo,
) => TResult | Promise<TResult>;

export interface ResolveInfo {
  fieldName: string;
  fieldNodes: FieldNode[];
  returnType: GraphQLType;
  parentType: GraphQLObjectType;
  path: ResponsePath;
  schema: GraphQLSchema;
  fragments: Map<string, FragmentDefinitionNode>;
  rootValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: Record<string, unknown>;
}

export interface ResponsePath {
  prev?: ResponsePath;
  key: string | number;
  typename?: string;
}

export interface ExecutionResult {
  data?: Record<string, unknown> | null;
  errors?: GraphQLFormattedError[];
}

export interface GraphQLFormattedError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: Map<string, FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: Record<string, unknown>;
  errors: GraphQLFormattedError[];
  maxDepth?: number;
  maxComplexity?: number;
}

// ─── Subscription Types ───────────────────────────────────────────────────

export type SubscribeFunction<TPayload = unknown> = (
  parent: unknown,
  args: Record<string, unknown>,
  context: unknown,
  info: ResolveInfo,
) => AsyncIterableIterator<TPayload> | Promise<AsyncIterableIterator<TPayload>>;

export interface SubscriptionConfig {
  subscribe: SubscribeFunction;
  resolve?: ResolverFn;
  filter?: (payload: unknown, variables: Record<string, unknown>, context: unknown) => boolean | Promise<boolean>;
}

// ─── Resolver Types ───────────────────────────────────────────────────────

export interface ResolverMap {
  [typeName: string]: {
    [fieldName: string]: ResolverFn | SubscriptionConfig;
  };
}

export interface ResolverClassMetadata {
  typeName?: string;
  queries: Map<string, { methodName: string; name: string }>;
  mutations: Map<string, { methodName: string; name: string }>;
  subscriptions: Map<string, { methodName: string; name: string }>;
  fields: Map<string, { methodName: string; fieldType?: string }>;
  params: Map<string, Map<number, ParamMetadata>>;
}

export interface ParamMetadata {
  kind: "arg" | "ctx" | "info";
  name?: string;
  type?: string;
}

// ─── HTTP Types ───────────────────────────────────────────────────────────

export interface GraphQLHTTPRequest {
  query?: string;
  operationName?: string;
  variables?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLHTTPOptions {
  schema: GraphQLSchema;
  rootValue?: unknown;
  context?: unknown | ((req: unknown) => unknown | Promise<unknown>);
  graphiql?: boolean;
  persistedQueries?: Map<string, string>;
  maxBatchSize?: number;
}

// ─── Module Types ─────────────────────────────────────────────────────────

export interface GraphQLModuleOptions {
  typeDefs?: string;
  resolvers?: ResolverMap;
  context?: unknown | ((req: unknown) => unknown | Promise<unknown>);
  graphiql?: boolean;
  path?: string;
  maxDepth?: number;
  maxComplexity?: number;
}
