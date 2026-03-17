// @nexus/orm - SQL Query Builder

import type {
  SqlResult,
  WhereOperator,
  JoinType,
  OrderDirection,
  RawSql,
} from "./types.js";

/**
 * Create a raw SQL expression
 */
export function raw(sql: string, bindings: unknown[] = []): RawSql {
  return { __raw: true, sql, bindings };
}

function isRaw(value: unknown): value is RawSql {
  return value !== null && typeof value === "object" && "__raw" in value;
}

type QueryType = "select" | "insert" | "update" | "delete";

interface WhereEntry {
  type: "condition" | "raw" | "group";
  connector: "AND" | "OR";
  column?: string;
  operator?: WhereOperator;
  value?: unknown;
  raw?: RawSql;
  group?: WhereEntry[];
}


/**
 * SQL Query Builder with fluent API
 */
export class QueryBuilder {
  private _type: QueryType = "select";
  private _table = "";
  private _columns: string[] = ["*"];
  private _wheres: WhereEntry[] = [];
  private _joins: Array<{ type: JoinType; table: string; on: string }> = [];
  private _groupBy: string[] = [];
  private _having: WhereEntry[] = [];
  private _orderBy: Array<{ column: string; direction: OrderDirection }> = [];
  private _limit: number | undefined;
  private _offset: number | undefined;
  private _distinct = false;
  private _subqueries: Map<string, QueryBuilder> = new Map();

  /**
   * Set SELECT columns
   */
  select(...columns: string[]): QueryBuilder {
    this._type = "select";
    if (columns.length > 0) {
      this._columns = columns;
    }
    return this;
  }

  /**
   * Set DISTINCT
   */
  distinct(): QueryBuilder {
    this._distinct = true;
    return this;
  }

  /**
   * Set FROM table
   */
  from(table: string): QueryBuilder {
    this._table = table;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(column: string | RawSql, operator?: WhereOperator | unknown, value?: unknown): QueryBuilder {
    if (isRaw(column)) {
      this._wheres.push({ type: "raw", connector: "AND", raw: column });
      return this;
    }

    // Support shorthand where("col", value) => where("col", "=", value)
    if (value === undefined && operator !== undefined) {
      value = operator;
      operator = "=";
    }

    this._wheres.push({
      type: "condition",
      connector: "AND",
      column: column as string,
      operator: operator as WhereOperator,
      value,
    });
    return this;
  }

  /**
   * Add OR WHERE condition
   */
  orWhere(column: string, operator?: WhereOperator | unknown, value?: unknown): QueryBuilder {
    if (value === undefined && operator !== undefined) {
      value = operator;
      operator = "=";
    }

    this._wheres.push({
      type: "condition",
      connector: "OR",
      column,
      operator: operator as WhereOperator,
      value,
    });
    return this;
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(column: string, values: unknown[]): QueryBuilder {
    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: "IN",
      value: values,
    });
    return this;
  }

  /**
   * Add WHERE NOT IN condition
   */
  whereNotIn(column: string, values: unknown[]): QueryBuilder {
    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: "NOT IN",
      value: values,
    });
    return this;
  }

  /**
   * Add WHERE NULL condition
   */
  whereNull(column: string): QueryBuilder {
    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: "IS",
      value: null,
    });
    return this;
  }

  /**
   * Add WHERE NOT NULL condition
   */
  whereNotNull(column: string): QueryBuilder {
    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: "IS NOT",
      value: null,
    });
    return this;
  }

  /**
   * Add WHERE BETWEEN condition
   */
  whereBetween(column: string, min: unknown, max: unknown): QueryBuilder {
    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: "BETWEEN",
      value: [min, max],
    });
    return this;
  }

  /**
   * Add JOIN
   */
  join(table: string, on: string): QueryBuilder {
    this._joins.push({ type: "INNER", table, on });
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin(table: string, on: string): QueryBuilder {
    this._joins.push({ type: "LEFT", table, on });
    return this;
  }

  /**
   * Add RIGHT JOIN
   */
  rightJoin(table: string, on: string): QueryBuilder {
    this._joins.push({ type: "RIGHT", table, on });
    return this;
  }

  /**
   * Add CROSS JOIN
   */
  crossJoin(table: string): QueryBuilder {
    this._joins.push({ type: "CROSS", table, on: "" });
    return this;
  }

  /**
   * Set GROUP BY columns
   */
  groupBy(...columns: string[]): QueryBuilder {
    this._groupBy.push(...columns);
    return this;
  }

  /**
   * Add HAVING condition
   */
  having(column: string, operator: WhereOperator | unknown, value?: unknown): QueryBuilder {
    if (value === undefined && operator !== undefined) {
      value = operator;
      operator = "=";
    }

    this._having.push({
      type: "condition",
      connector: "AND",
      column,
      operator: operator as WhereOperator,
      value,
    });
    return this;
  }

  /**
   * Set ORDER BY
   */
  orderBy(column: string, direction: OrderDirection = "ASC"): QueryBuilder {
    this._orderBy.push({ column, direction });
    return this;
  }

  /**
   * Set LIMIT
   */
  limit(n: number): QueryBuilder {
    this._limit = n;
    return this;
  }

  /**
   * Set OFFSET
   */
  offset(n: number): QueryBuilder {
    this._offset = n;
    return this;
  }

  /**
   * Create INSERT query
   */
  insert(table: string): InsertBuilder {
    return new InsertBuilder(table);
  }

  /**
   * Create UPDATE query
   */
  update(table: string): UpdateBuilder {
    return new UpdateBuilder(table);
  }

  /**
   * Create DELETE query
   */
  deleteFrom(table: string): DeleteBuilder {
    return new DeleteBuilder(table);
  }

  /**
   * Add a subquery as a source
   */
  fromSubquery(subquery: QueryBuilder, alias: string): QueryBuilder {
    this._subqueries.set(alias, subquery);
    this._table = `(${alias})`;
    return this;
  }

  /**
   * Build the SQL query and params
   */
  toSQL(): SqlResult {
    switch (this._type) {
      case "select":
        return this._buildSelect();
      default:
        return this._buildSelect();
    }
  }

  private _buildSelect(): SqlResult {
    const parts: string[] = [];
    const params: unknown[] = [];

    // SELECT
    const distinctStr = this._distinct ? "DISTINCT " : "";
    parts.push(`SELECT ${distinctStr}${this._columns.join(", ")}`);

    // FROM
    if (this._table) {
      if (this._subqueries.size > 0) {
        // Handle subquery in FROM
        for (const [alias, sub] of this._subqueries) {
          const subResult = sub.toSQL();
          parts.push(`FROM (${subResult.sql}) AS ${alias}`);
          params.push(...subResult.params);
        }
      } else {
        parts.push(`FROM ${this._table}`);
      }
    }

    // JOINS
    for (const join of this._joins) {
      if (join.type === "CROSS") {
        parts.push(`CROSS JOIN ${join.table}`);
      } else {
        parts.push(`${join.type} JOIN ${join.table} ON ${join.on}`);
      }
    }

    // WHERE
    const whereResult = this._buildWhereClause(this._wheres);
    if (whereResult.sql) {
      parts.push(`WHERE ${whereResult.sql}`);
      params.push(...whereResult.params);
    }

    // GROUP BY
    if (this._groupBy.length > 0) {
      parts.push(`GROUP BY ${this._groupBy.join(", ")}`);
    }

    // HAVING
    const havingResult = this._buildWhereClause(this._having);
    if (havingResult.sql) {
      parts.push(`HAVING ${havingResult.sql}`);
      params.push(...havingResult.params);
    }

    // ORDER BY
    if (this._orderBy.length > 0) {
      const orderParts = this._orderBy.map(
        (o) => `${o.column} ${o.direction}`,
      );
      parts.push(`ORDER BY ${orderParts.join(", ")}`);
    }

    // LIMIT
    if (this._limit !== undefined) {
      parts.push(`LIMIT ?`);
      params.push(this._limit);
    }

    // OFFSET
    if (this._offset !== undefined) {
      parts.push(`OFFSET ?`);
      params.push(this._offset);
    }

    return { sql: parts.join(" "), params };
  }

  private _buildWhereClause(entries: WhereEntry[]): { sql: string; params: unknown[] } {
    if (entries.length === 0) return { sql: "", params: [] };

    const parts: string[] = [];
    const params: unknown[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      let clause = "";

      if (entry.type === "raw" && entry.raw) {
        clause = entry.raw.sql;
        params.push(...entry.raw.bindings);
      } else if (entry.type === "condition") {
        if (entry.operator === "IN" || entry.operator === "NOT IN") {
          const values = entry.value as unknown[];
          const placeholders = values.map(() => "?").join(", ");
          clause = `${entry.column} ${entry.operator} (${placeholders})`;
          params.push(...values);
        } else if (entry.operator === "BETWEEN") {
          const [min, max] = entry.value as [unknown, unknown];
          clause = `${entry.column} BETWEEN ? AND ?`;
          params.push(min, max);
        } else if (entry.value === null) {
          clause = `${entry.column} ${entry.operator} NULL`;
        } else {
          clause = `${entry.column} ${entry.operator} ?`;
          params.push(entry.value);
        }
      }

      if (i === 0) {
        parts.push(clause);
      } else {
        parts.push(`${entry.connector} ${clause}`);
      }
    }

    return { sql: parts.join(" "), params };
  }
}

/**
 * Insert query builder
 */
export class InsertBuilder {
  private _values: Record<string, unknown>[] = [];

  constructor(private readonly _table: string) {}

  /**
   * Set values to insert (single or bulk)
   */
  values(data: Record<string, unknown> | Record<string, unknown>[]): InsertBuilder {
    if (Array.isArray(data)) {
      this._values = data;
    } else {
      this._values = [data];
    }
    return this;
  }

  /**
   * Build the SQL
   */
  toSQL(): SqlResult {
    if (this._values.length === 0) {
      return { sql: `INSERT INTO ${this._table} DEFAULT VALUES`, params: [] };
    }

    const columns = Object.keys(this._values[0]);
    const params: unknown[] = [];
    const rows: string[] = [];

    for (const row of this._values) {
      const placeholders: string[] = [];
      for (const col of columns) {
        placeholders.push("?");
        params.push(row[col]);
      }
      rows.push(`(${placeholders.join(", ")})`);
    }

    const sql = `INSERT INTO ${this._table} (${columns.join(", ")}) VALUES ${rows.join(", ")}`;
    return { sql, params };
  }
}

/**
 * Update query builder
 */
export class UpdateBuilder {
  private _set: Record<string, unknown> = {};
  private _wheres: WhereEntry[] = [];

  constructor(private readonly _table: string) {}

  /**
   * Set columns to update
   */
  set(data: Record<string, unknown>): UpdateBuilder {
    this._set = { ...this._set, ...data };
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(column: string, operator?: WhereOperator | unknown, value?: unknown): UpdateBuilder {
    if (value === undefined && operator !== undefined) {
      value = operator;
      operator = "=";
    }

    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: operator as WhereOperator,
      value,
    });
    return this;
  }

  /**
   * Build the SQL
   */
  toSQL(): SqlResult {
    const columns = Object.keys(this._set);
    const params: unknown[] = [];

    const setParts = columns.map((col) => {
      params.push(this._set[col]);
      return `${col} = ?`;
    });

    let sql = `UPDATE ${this._table} SET ${setParts.join(", ")}`;

    if (this._wheres.length > 0) {
      const whereResult = this._buildWhere();
      sql += ` WHERE ${whereResult.sql}`;
      params.push(...whereResult.params);
    }

    return { sql, params };
  }

  private _buildWhere(): { sql: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];

    for (let i = 0; i < this._wheres.length; i++) {
      const entry = this._wheres[i];
      const clause = `${entry.column} ${entry.operator} ?`;
      params.push(entry.value);

      if (i === 0) {
        parts.push(clause);
      } else {
        parts.push(`${entry.connector} ${clause}`);
      }
    }

    return { sql: parts.join(" "), params };
  }
}

/**
 * Delete query builder
 */
export class DeleteBuilder {
  private _wheres: WhereEntry[] = [];

  constructor(private readonly _table: string) {}

  /**
   * Add WHERE condition
   */
  where(column: string, operator?: WhereOperator | unknown, value?: unknown): DeleteBuilder {
    if (value === undefined && operator !== undefined) {
      value = operator;
      operator = "=";
    }

    this._wheres.push({
      type: "condition",
      connector: "AND",
      column,
      operator: operator as WhereOperator,
      value,
    });
    return this;
  }

  /**
   * Build the SQL
   */
  toSQL(): SqlResult {
    const params: unknown[] = [];
    let sql = `DELETE FROM ${this._table}`;

    if (this._wheres.length > 0) {
      const parts: string[] = [];
      for (let i = 0; i < this._wheres.length; i++) {
        const entry = this._wheres[i];
        const clause = `${entry.column} ${entry.operator} ?`;
        params.push(entry.value);

        if (i === 0) {
          parts.push(clause);
        } else {
          parts.push(`${entry.connector} ${clause}`);
        }
      }
      sql += ` WHERE ${parts.join(" ")}`;
    }

    return { sql, params };
  }
}
