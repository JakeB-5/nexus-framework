// @nexus/orm - SQL Dialect abstraction

import type { ColumnType, DialectInterface } from "./types.js";

/**
 * SQLite dialect implementation
 */
export class SqliteDialect implements DialectInterface {
  readonly name = "sqlite";

  columnTypeToSql(type: ColumnType, length?: number): string {
    switch (type) {
      case "integer":
      case "bigint":
        return "INTEGER";
      case "text":
        return "TEXT";
      case "varchar":
        return length ? `VARCHAR(${length})` : "VARCHAR(255)";
      case "boolean":
        return "INTEGER";
      case "date":
      case "timestamp":
        return "TEXT";
      case "json":
        return "TEXT";
      case "uuid":
        return "TEXT";
      case "float":
        return "REAL";
      case "decimal":
        return "REAL";
      case "blob":
        return "BLOB";
      case "enum":
        return "TEXT";
    }
  }

  autoIncrementKeyword(): string {
    return "AUTOINCREMENT";
  }

  quoteIdentifier(name: string): string {
    return `"${name}"`;
  }

  supportsReturning(): boolean {
    return true; // SQLite 3.35+
  }

  currentTimestamp(): string {
    return "CURRENT_TIMESTAMP";
  }
}

/**
 * PostgreSQL dialect implementation (SQL generation only)
 */
export class PostgresDialect implements DialectInterface {
  readonly name = "postgres";

  columnTypeToSql(type: ColumnType, length?: number, precision?: number, scale?: number): string {
    switch (type) {
      case "integer":
        return "INTEGER";
      case "bigint":
        return "BIGINT";
      case "text":
        return "TEXT";
      case "varchar":
        return length ? `VARCHAR(${length})` : "VARCHAR(255)";
      case "boolean":
        return "BOOLEAN";
      case "date":
        return "DATE";
      case "timestamp":
        return "TIMESTAMP WITH TIME ZONE";
      case "json":
        return "JSONB";
      case "uuid":
        return "UUID";
      case "float":
        return "DOUBLE PRECISION";
      case "decimal":
        return precision && scale ? `DECIMAL(${precision}, ${scale})` : "DECIMAL";
      case "blob":
        return "BYTEA";
      case "enum":
        return "TEXT";
    }
  }

  autoIncrementKeyword(): string {
    return ""; // Postgres uses SERIAL/BIGSERIAL
  }

  quoteIdentifier(name: string): string {
    return `"${name}"`;
  }

  supportsReturning(): boolean {
    return true;
  }

  currentTimestamp(): string {
    return "NOW()";
  }
}

/**
 * MySQL dialect implementation (SQL generation only)
 */
export class MysqlDialect implements DialectInterface {
  readonly name = "mysql";

  columnTypeToSql(type: ColumnType, length?: number, precision?: number, scale?: number): string {
    switch (type) {
      case "integer":
        return "INT";
      case "bigint":
        return "BIGINT";
      case "text":
        return "TEXT";
      case "varchar":
        return length ? `VARCHAR(${length})` : "VARCHAR(255)";
      case "boolean":
        return "TINYINT(1)";
      case "date":
        return "DATE";
      case "timestamp":
        return "TIMESTAMP";
      case "json":
        return "JSON";
      case "uuid":
        return "CHAR(36)";
      case "float":
        return "DOUBLE";
      case "decimal":
        return precision && scale ? `DECIMAL(${precision}, ${scale})` : "DECIMAL(10, 2)";
      case "blob":
        return "BLOB";
      case "enum":
        return "VARCHAR(255)";
    }
  }

  autoIncrementKeyword(): string {
    return "AUTO_INCREMENT";
  }

  quoteIdentifier(name: string): string {
    return `\`${name}\``;
  }

  supportsReturning(): boolean {
    return false;
  }

  currentTimestamp(): string {
    return "NOW()";
  }
}

/**
 * Create a dialect instance by name
 */
export function createDialect(name: "sqlite" | "postgres" | "mysql"): DialectInterface {
  switch (name) {
    case "sqlite":
      return new SqliteDialect();
    case "postgres":
      return new PostgresDialect();
    case "mysql":
      return new MysqlDialect();
  }
}
