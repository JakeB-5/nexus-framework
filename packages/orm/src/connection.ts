// @nexus/orm - Database connection management

import type { DatabaseConnectionInterface } from "./types.js";
import { ConnectionError } from "./errors.js";

/**
 * Abstract database connection
 */
export abstract class DatabaseConnection implements DatabaseConnectionInterface {
  protected _connected = false;

  abstract execute(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  abstract close(): Promise<void>;

  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Begin a transaction
   */
  async begin(): Promise<void> {
    await this.execute("BEGIN");
  }

  /**
   * Commit a transaction
   */
  async commit(): Promise<void> {
    await this.execute("COMMIT");
  }

  /**
   * Rollback a transaction
   */
  async rollback(): Promise<void> {
    await this.execute("ROLLBACK");
  }

  /**
   * Create a savepoint
   */
  async savepoint(name: string): Promise<void> {
    await this.execute(`SAVEPOINT ${name}`);
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(name: string): Promise<void> {
    await this.execute(`RELEASE SAVEPOINT ${name}`);
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackToSavepoint(name: string): Promise<void> {
    await this.execute(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  /**
   * Run a callback within a transaction
   */
  async transaction<T>(callback: (conn: this) => Promise<T>): Promise<T> {
    await this.begin();
    try {
      const result = await callback(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

/**
 * In-memory SQLite-like connection for testing (no external dependencies)
 */
export class InMemoryConnection extends DatabaseConnection {
  private readonly _tables: Map<string, {
    columns: string[];
    rows: Record<string, unknown>[];
  }> = new Map();
  private readonly _log: Array<{ sql: string; params: unknown[] }> = [];
  private _txActive = false;
  private _snapshot: Map<string, { columns: string[]; rows: Record<string, unknown>[] }> | undefined;

  /**
   * Whether a transaction is currently active
   */
  get inTransaction(): boolean {
    return this._txActive;
  }

  constructor() {
    super();
    this._connected = true;
  }

  /**
   * Get query log for testing
   */
  getQueryLog(): Array<{ sql: string; params: unknown[] }> {
    return [...this._log];
  }

  /**
   * Clear query log
   */
  clearQueryLog(): void {
    this._log.length = 0;
  }

  async execute(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    if (!this._connected) {
      throw new ConnectionError("Connection is closed");
    }

    this._log.push({ sql, params });

    const trimmed = sql.trim().toUpperCase();

    if (trimmed === "BEGIN") {
      this._txActive = true;
      // Take snapshot for rollback
      this._snapshot = new Map();
      for (const [name, table] of this._tables) {
        this._snapshot.set(name, {
          columns: [...table.columns],
          rows: table.rows.map((r) => ({ ...r })),
        });
      }
      return [];
    }

    if (trimmed === "COMMIT") {
      this._txActive = false;
      this._snapshot = undefined;
      return [];
    }

    if (trimmed === "ROLLBACK") {
      this._txActive = false;
      if (this._snapshot) {
        this._tables.clear();
        for (const [name, table] of this._snapshot) {
          this._tables.set(name, table);
        }
        this._snapshot = undefined;
      }
      return [];
    }

    // Handle savepoints
    if (trimmed.startsWith("SAVEPOINT") || trimmed.startsWith("RELEASE SAVEPOINT") || trimmed.startsWith("ROLLBACK TO SAVEPOINT")) {
      return [];
    }

    // Simple CREATE TABLE parsing
    if (trimmed.startsWith("CREATE TABLE")) {
      const match = sql.match(/CREATE TABLE\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        // Extract column names from parenthesized definition
        const bodyMatch = sql.match(/\(([^)]+(?:\([^)]*\))*[^)]*)\)/s);
        const columns: string[] = [];
        if (bodyMatch) {
          const body = bodyMatch[1];
          const parts = body.split(",").map((p) => p.trim());
          for (const part of parts) {
            // Skip constraints
            if (/^(PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY|INDEX)/i.test(part)) continue;
            const colName = part.split(/\s+/)[0];
            if (colName) columns.push(colName);
          }
        }
        this._tables.set(tableName, { columns, rows: [] });
      }
      return [];
    }

    // Simple INSERT parsing
    if (trimmed.startsWith("INSERT INTO")) {
      const match = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
      if (match) {
        const tableName = match[1];
        const columns = match[2].split(",").map((c) => c.trim());
        const table = this._tables.get(tableName);
        if (!table) {
          table; // will be undefined, auto-create
          this._tables.set(tableName, { columns, rows: [] });
        }

        // Parse value groups
        const valuesStr = sql.slice(sql.toUpperCase().indexOf("VALUES") + 6).trim();
        const groups = valuesStr.split(/\),\s*\(/);
        let paramIdx = 0;

        for (const _group of groups) {
          const row: Record<string, unknown> = {};
          for (const col of columns) {
            row[col] = params[paramIdx++];
          }
          const t = this._tables.get(tableName);
          if (t) t.rows.push(row);
        }
      }
      return [];
    }

    // Simple SELECT parsing
    if (trimmed.startsWith("SELECT")) {
      // Return empty for now - real DB would execute
      return [];
    }

    // Simple UPDATE parsing
    if (trimmed.startsWith("UPDATE")) {
      return [];
    }

    // Simple DELETE parsing
    if (trimmed.startsWith("DELETE")) {
      return [];
    }

    // DROP, ALTER, CREATE INDEX, etc
    if (trimmed.startsWith("DROP TABLE")) {
      const match = sql.match(/DROP TABLE(?:\s+IF EXISTS)?\s+(\w+)/i);
      if (match) {
        this._tables.delete(match[1]);
      }
      return [];
    }

    return [];
  }

  async close(): Promise<void> {
    this._connected = false;
  }

  /**
   * Get table data for testing
   */
  getTableData(name: string): Record<string, unknown>[] {
    return this._tables.get(name)?.rows ?? [];
  }

  /**
   * Check if table exists
   */
  hasTable(name: string): boolean {
    return this._tables.has(name);
  }
}

/**
 * Connection pool manager
 */
export class ConnectionManager {
  private readonly _connections: Map<string, DatabaseConnection> = new Map();
  private _defaultName = "default";

  /**
   * Register a connection
   */
  register(name: string, connection: DatabaseConnection): void {
    this._connections.set(name, connection);
  }

  /**
   * Get a connection by name
   */
  get(name?: string): DatabaseConnection {
    const connName = name ?? this._defaultName;
    const conn = this._connections.get(connName);
    if (!conn) {
      throw new ConnectionError(`Connection "${connName}" not found`);
    }
    return conn;
  }

  /**
   * Set the default connection name
   */
  setDefault(name: string): void {
    this._defaultName = name;
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    for (const conn of this._connections.values()) {
      await conn.close();
    }
    this._connections.clear();
  }

  /**
   * Check if a connection exists
   */
  has(name: string): boolean {
    return this._connections.has(name);
  }

  /**
   * Create an in-memory connection for testing
   */
  static createInMemory(name = "default"): { manager: ConnectionManager; connection: InMemoryConnection } {
    const manager = new ConnectionManager();
    const connection = new InMemoryConnection();
    manager.register(name, connection);
    return { manager, connection };
  }
}
