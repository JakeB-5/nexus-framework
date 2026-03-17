// @nexus/orm - Type definitions

/**
 * SQL query result
 */
export interface SqlResult {
  sql: string;
  params: unknown[];
}

/**
 * Where condition types
 */
export type WhereOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "NOT IN" | "IS" | "IS NOT" | "BETWEEN";

export interface WhereCondition {
  column: string;
  operator: WhereOperator;
  value: unknown;
}

export type WhereClause = WhereCondition | RawSql;

/**
 * Raw SQL expression
 */
export interface RawSql {
  __raw: true;
  sql: string;
  bindings: unknown[];
}

/**
 * Join types
 */
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "CROSS";

export interface JoinClause {
  type: JoinType;
  table: string;
  on: string;
}

/**
 * Order direction
 */
export type OrderDirection = "ASC" | "DESC";

export interface OrderByClause {
  column: string;
  direction: OrderDirection;
}

/**
 * Column definition for schema builder
 */
export type ColumnType =
  | "integer"
  | "bigint"
  | "text"
  | "varchar"
  | "boolean"
  | "date"
  | "timestamp"
  | "json"
  | "uuid"
  | "float"
  | "decimal"
  | "blob"
  | "enum";

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  length?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  defaultValue?: unknown;
  references?: { table: string; column: string };
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
  enumValues?: string[];
  isAutoIncrement: boolean;
}

export type ForeignKeyAction = "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";

/**
 * Connection options
 */
export interface ConnectionOptions {
  dialect: "sqlite" | "postgres" | "mysql";
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filename?: string;
  pool?: PoolOptions;
}

export interface PoolOptions {
  min?: number;
  max?: number;
  idleTimeout?: number;
}

/**
 * Migration interface
 */
export interface Migration {
  name: string;
  up(builder: import("./schema-builder.js").SchemaBuilder): void;
  down(builder: import("./schema-builder.js").SchemaBuilder): void;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  name: string;
  batch: number;
  executedAt: Date;
}

/**
 * Seeder interface
 */
export interface Seeder {
  name: string;
  run(): Promise<void>;
}

/**
 * Model hook types
 */
export type ModelHookType =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete";

/**
 * Relationship types
 */
export type RelationType = "hasOne" | "hasMany" | "belongsTo" | "belongsToMany";

export interface RelationDefinition {
  type: RelationType;
  model: string;
  foreignKey: string;
  localKey: string;
  pivotTable?: string;
  pivotForeignKey?: string;
  pivotLocalKey?: string;
}

/**
 * Dialect interface
 */
export interface DialectInterface {
  name: string;
  columnTypeToSql(type: ColumnType, length?: number, precision?: number, scale?: number): string;
  autoIncrementKeyword(): string;
  quoteIdentifier(name: string): string;
  supportsReturning(): boolean;
  currentTimestamp(): string;
}

/**
 * Database connection interface
 */
export interface DatabaseConnectionInterface {
  execute(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
  isConnected(): boolean;
}
