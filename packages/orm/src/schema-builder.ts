// @nexus/orm - Table Schema Builder (DDL)

import type {
  ColumnType,
  ColumnDefinition,
  ForeignKeyAction,
  DialectInterface,
} from "./types.js";
import { SqliteDialect } from "./dialect.js";

/**
 * Column builder for fluent column definition
 */
export class ColumnBuilder {
  private readonly _definition: ColumnDefinition;

  constructor(name: string, type: ColumnType, length?: number) {
    this._definition = {
      name,
      type,
      length,
      isPrimaryKey: false,
      isNotNull: false,
      isUnique: false,
      isAutoIncrement: false,
    };
  }

  get definition(): ColumnDefinition {
    return this._definition;
  }

  primaryKey(): ColumnBuilder {
    this._definition.isPrimaryKey = true;
    this._definition.isNotNull = true;
    return this;
  }

  autoIncrement(): ColumnBuilder {
    this._definition.isAutoIncrement = true;
    return this;
  }

  notNull(): ColumnBuilder {
    this._definition.isNotNull = true;
    return this;
  }

  unique(): ColumnBuilder {
    this._definition.isUnique = true;
    return this;
  }

  default(value: unknown): ColumnBuilder {
    this._definition.defaultValue = value;
    return this;
  }

  references(table: string, column: string): ColumnBuilder {
    this._definition.references = { table, column };
    return this;
  }

  onDelete(action: ForeignKeyAction): ColumnBuilder {
    this._definition.onDelete = action;
    return this;
  }

  onUpdate(action: ForeignKeyAction): ColumnBuilder {
    this._definition.onUpdate = action;
    return this;
  }
}

/**
 * Table builder for CREATE TABLE
 */
export class TableBuilder {
  private readonly _columns: ColumnBuilder[] = [];
  private readonly _compositeKeys: { type: "primary" | "unique"; columns: string[] }[] = [];
  private readonly _indexes: { columns: string[]; unique: boolean; name?: string }[] = [];
  private readonly _checks: string[] = [];

  integer(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "integer");
    this._columns.push(col);
    return col;
  }

  bigint(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "bigint");
    this._columns.push(col);
    return col;
  }

  text(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "text");
    this._columns.push(col);
    return col;
  }

  varchar(name: string, length = 255): ColumnBuilder {
    const col = new ColumnBuilder(name, "varchar", length);
    this._columns.push(col);
    return col;
  }

  boolean(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "boolean");
    this._columns.push(col);
    return col;
  }

  date(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "date");
    this._columns.push(col);
    return col;
  }

  timestamp(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "timestamp");
    this._columns.push(col);
    return col;
  }

  json(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "json");
    this._columns.push(col);
    return col;
  }

  uuid(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "uuid");
    this._columns.push(col);
    return col;
  }

  float(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "float");
    this._columns.push(col);
    return col;
  }

  decimal(name: string, precision = 10, scale = 2): ColumnBuilder {
    const col = new ColumnBuilder(name, "decimal");
    col.definition.precision = precision;
    col.definition.scale = scale;
    this._columns.push(col);
    return col;
  }

  blob(name: string): ColumnBuilder {
    const col = new ColumnBuilder(name, "blob");
    this._columns.push(col);
    return col;
  }

  enum(name: string, values: string[]): ColumnBuilder {
    const col = new ColumnBuilder(name, "enum");
    col.definition.enumValues = values;
    this._columns.push(col);
    return col;
  }

  /**
   * Add id column (integer primary key auto increment)
   */
  id(name = "id"): ColumnBuilder {
    return this.integer(name).primaryKey().autoIncrement();
  }

  /**
   * Add timestamps (created_at, updated_at)
   */
  timestamps(): void {
    this.timestamp("created_at").default("CURRENT_TIMESTAMP");
    this.timestamp("updated_at").default("CURRENT_TIMESTAMP");
  }

  /**
   * Add soft delete column
   */
  softDeletes(name = "deleted_at"): ColumnBuilder {
    return this.timestamp(name);
  }

  /**
   * Composite primary key
   */
  compositePrimaryKey(...columns: string[]): void {
    this._compositeKeys.push({ type: "primary", columns });
  }

  /**
   * Composite unique constraint
   */
  compositeUnique(...columns: string[]): void {
    this._compositeKeys.push({ type: "unique", columns });
  }

  /**
   * Add an index
   */
  index(columns: string[], name?: string): void {
    this._indexes.push({ columns, unique: false, name });
  }

  /**
   * Add a unique index
   */
  uniqueIndex(columns: string[], name?: string): void {
    this._indexes.push({ columns, unique: true, name });
  }

  /**
   * Add a CHECK constraint
   */
  check(expression: string): void {
    this._checks.push(expression);
  }

  /**
   * Get all column definitions
   */
  getColumns(): ColumnDefinition[] {
    return this._columns.map((c) => c.definition);
  }

  /**
   * Get composite keys
   */
  getCompositeKeys(): { type: "primary" | "unique"; columns: string[] }[] {
    return this._compositeKeys;
  }

  /**
   * Get indexes
   */
  getIndexes(): { columns: string[]; unique: boolean; name?: string }[] {
    return this._indexes;
  }

  /**
   * Get check constraints
   */
  getChecks(): string[] {
    return this._checks;
  }
}

/**
 * Alter table builder
 */
export class AlterTableBuilder {
  private readonly _addColumns: ColumnBuilder[] = [];
  private readonly _dropColumns: string[] = [];
  private readonly _renameColumns: { from: string; to: string }[] = [];

  addColumn(name: string, type: ColumnType, length?: number): ColumnBuilder {
    const col = new ColumnBuilder(name, type, length);
    this._addColumns.push(col);
    return col;
  }

  dropColumn(name: string): void {
    this._dropColumns.push(name);
  }

  renameColumn(from: string, to: string): void {
    this._renameColumns.push({ from, to });
  }

  getAddColumns(): ColumnDefinition[] {
    return this._addColumns.map((c) => c.definition);
  }

  getDropColumns(): string[] {
    return this._dropColumns;
  }

  getRenameColumns(): { from: string; to: string }[] {
    return this._renameColumns;
  }
}

/**
 * Schema builder - generates DDL SQL
 */
export class SchemaBuilder {
  private readonly _statements: string[] = [];
  private readonly _dialect: DialectInterface;

  constructor(dialect?: DialectInterface) {
    this._dialect = dialect ?? new SqliteDialect();
  }

  /**
   * Create a table
   */
  createTable(name: string, builder: (table: TableBuilder) => void): SchemaBuilder {
    const table = new TableBuilder();
    builder(table);

    const columns = table.getColumns();
    const lines: string[] = [];

    for (const col of columns) {
      lines.push(this._columnToSql(col));
    }

    // Composite keys
    for (const key of table.getCompositeKeys()) {
      if (key.type === "primary") {
        lines.push(`PRIMARY KEY (${key.columns.join(", ")})`);
      } else {
        lines.push(`UNIQUE (${key.columns.join(", ")})`);
      }
    }

    // Check constraints
    for (const check of table.getChecks()) {
      lines.push(`CHECK (${check})`);
    }

    this._statements.push(
      `CREATE TABLE ${name} (\n  ${lines.join(",\n  ")}\n)`,
    );

    // Create indexes (separate statements)
    for (const idx of table.getIndexes()) {
      const idxName = idx.name ?? `idx_${name}_${idx.columns.join("_")}`;
      const uniqueStr = idx.unique ? "UNIQUE " : "";
      this._statements.push(
        `CREATE ${uniqueStr}INDEX ${idxName} ON ${name} (${idx.columns.join(", ")})`,
      );
    }

    return this;
  }

  /**
   * Alter a table
   */
  alterTable(name: string, builder: (table: AlterTableBuilder) => void): SchemaBuilder {
    const alter = new AlterTableBuilder();
    builder(alter);

    for (const col of alter.getAddColumns()) {
      this._statements.push(
        `ALTER TABLE ${name} ADD COLUMN ${this._columnToSql(col)}`,
      );
    }

    for (const colName of alter.getDropColumns()) {
      this._statements.push(
        `ALTER TABLE ${name} DROP COLUMN ${colName}`,
      );
    }

    for (const rename of alter.getRenameColumns()) {
      this._statements.push(
        `ALTER TABLE ${name} RENAME COLUMN ${rename.from} TO ${rename.to}`,
      );
    }

    return this;
  }

  /**
   * Drop a table
   */
  dropTable(name: string, cascade = false): SchemaBuilder {
    const cascadeStr = cascade ? " CASCADE" : "";
    this._statements.push(`DROP TABLE ${name}${cascadeStr}`);
    return this;
  }

  /**
   * Drop table if exists
   */
  dropTableIfExists(name: string): SchemaBuilder {
    this._statements.push(`DROP TABLE IF EXISTS ${name}`);
    return this;
  }

  /**
   * Rename a table
   */
  renameTable(from: string, to: string): SchemaBuilder {
    this._statements.push(`ALTER TABLE ${from} RENAME TO ${to}`);
    return this;
  }

  /**
   * Get all generated SQL statements
   */
  toSQL(): string[] {
    return [...this._statements];
  }

  private _columnToSql(col: ColumnDefinition): string {
    const parts: string[] = [col.name];

    // Type
    if (col.isAutoIncrement && this._dialect.name === "postgres") {
      parts.push(col.type === "bigint" ? "BIGSERIAL" : "SERIAL");
    } else {
      parts.push(this._dialect.columnTypeToSql(col.type, col.length, col.precision, col.scale));
    }

    // Primary key
    if (col.isPrimaryKey) {
      parts.push("PRIMARY KEY");
    }

    // Auto increment (non-postgres)
    if (col.isAutoIncrement && this._dialect.name !== "postgres") {
      const kw = this._dialect.autoIncrementKeyword();
      if (kw) parts.push(kw);
    }

    // NOT NULL
    if (col.isNotNull && !col.isPrimaryKey) {
      parts.push("NOT NULL");
    }

    // UNIQUE
    if (col.isUnique) {
      parts.push("UNIQUE");
    }

    // DEFAULT
    if (col.defaultValue !== undefined) {
      const defaultVal = typeof col.defaultValue === "string"
        ? col.defaultValue.toUpperCase() === "CURRENT_TIMESTAMP"
          ? this._dialect.currentTimestamp()
          : `'${col.defaultValue}'`
        : String(col.defaultValue);
      parts.push(`DEFAULT ${defaultVal}`);
    }

    // REFERENCES
    if (col.references) {
      parts.push(`REFERENCES ${col.references.table}(${col.references.column})`);
      if (col.onDelete) parts.push(`ON DELETE ${col.onDelete}`);
      if (col.onUpdate) parts.push(`ON UPDATE ${col.onUpdate}`);
    }

    return parts.join(" ");
  }
}
