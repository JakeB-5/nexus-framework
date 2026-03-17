// @nexus/testing - In-memory test database utilities

import { TestSetupError } from "./errors.js";

/**
 * Row in a test database table
 */
type Row = Record<string, unknown>;

/**
 * In-memory table for testing
 */
class TestTable {
  private rows: Row[] = [];
  private autoId = 1;
  private readonly primaryKey: string;

  constructor(primaryKey = "id") {
    this.primaryKey = primaryKey;
  }

  /**
   * Insert a row (auto-generates primary key if not provided)
   */
  insert(row: Row): Row {
    const newRow = { ...row };
    if (newRow[this.primaryKey] === undefined) {
      newRow[this.primaryKey] = this.autoId++;
    }
    this.rows.push(newRow);
    return newRow;
  }

  /**
   * Insert multiple rows
   */
  insertMany(rows: Row[]): Row[] {
    return rows.map((row) => this.insert(row));
  }

  /**
   * Find all rows matching a predicate
   */
  find(predicate?: (row: Row) => boolean): Row[] {
    if (!predicate) return [...this.rows];
    return this.rows.filter(predicate);
  }

  /**
   * Find rows matching a where clause (key-value equality)
   */
  findWhere(where: Row): Row[] {
    return this.rows.filter((row) =>
      Object.entries(where).every(([key, value]) => row[key] === value),
    );
  }

  /**
   * Find a single row by primary key
   */
  findById(id: unknown): Row | undefined {
    return this.rows.find((row) => row[this.primaryKey] === id);
  }

  /**
   * Find the first row matching a predicate
   */
  findOne(predicate: (row: Row) => boolean): Row | undefined {
    return this.rows.find(predicate);
  }

  /**
   * Update rows matching a predicate
   */
  update(predicate: (row: Row) => boolean, updates: Row): number {
    let count = 0;
    for (const row of this.rows) {
      if (predicate(row)) {
        Object.assign(row, updates);
        count++;
      }
    }
    return count;
  }

  /**
   * Update a row by primary key
   */
  updateById(id: unknown, updates: Row): boolean {
    const row = this.findById(id);
    if (!row) return false;
    Object.assign(row, updates);
    return true;
  }

  /**
   * Delete rows matching a predicate
   */
  delete(predicate: (row: Row) => boolean): number {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !predicate(row));
    return before - this.rows.length;
  }

  /**
   * Delete a row by primary key
   */
  deleteById(id: unknown): boolean {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row[this.primaryKey] !== id);
    return this.rows.length < before;
  }

  /**
   * Count rows
   */
  count(predicate?: (row: Row) => boolean): number {
    if (!predicate) return this.rows.length;
    return this.rows.filter(predicate).length;
  }

  /**
   * Clear all rows and reset auto-increment
   */
  clear(): void {
    this.rows = [];
    this.autoId = 1;
  }

  /**
   * Get all rows (read-only copy)
   */
  get all(): Row[] {
    return [...this.rows];
  }
}

/**
 * In-memory database for testing
 */
export class TestDatabase {
  private tables = new Map<string, TestTable>();
  private seeds = new Map<string, () => Row[] | Promise<Row[]>>();

  /**
   * Create or get a table
   */
  table(name: string, primaryKey?: string): TestTable {
    if (!this.tables.has(name)) {
      this.tables.set(name, new TestTable(primaryKey));
    }
    return this.tables.get(name)!;
  }

  /**
   * Check if a table exists
   */
  hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  /**
   * Drop a table
   */
  dropTable(name: string): boolean {
    return this.tables.delete(name);
  }

  /**
   * Get all table names
   */
  get tableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * Register a seed function for a table
   */
  seed(tableName: string, seedFn: () => Row[] | Promise<Row[]>): void {
    this.seeds.set(tableName, seedFn);
  }

  /**
   * Run seeds for all registered tables
   */
  async runSeeds(): Promise<void> {
    for (const [tableName, seedFn] of this.seeds) {
      const tbl = this.table(tableName);
      const rows = await seedFn();
      tbl.insertMany(rows);
    }
  }

  /**
   * Run seed for a specific table
   */
  async runSeed(tableName: string): Promise<void> {
    const seedFn = this.seeds.get(tableName);
    if (!seedFn) {
      throw new TestSetupError(`No seed registered for table: ${tableName}`);
    }
    const tbl = this.table(tableName);
    const rows = await seedFn();
    tbl.insertMany(rows);
  }

  /**
   * Clear all tables
   */
  clear(): void {
    for (const table of this.tables.values()) {
      table.clear();
    }
  }

  /**
   * Reset database (drop all tables and seeds)
   */
  reset(): void {
    this.tables.clear();
    this.seeds.clear();
  }

  /**
   * Create a snapshot of the current database state
   */
  snapshot(): Map<string, Row[]> {
    const snap = new Map<string, Row[]>();
    for (const [name, table] of this.tables) {
      snap.set(name, table.all.map((row) => ({ ...row })));
    }
    return snap;
  }

  /**
   * Restore from a snapshot
   */
  restore(snap: Map<string, Row[]>): void {
    this.tables.clear();
    for (const [name, rows] of snap) {
      const tbl = this.table(name);
      tbl.insertMany(rows);
    }
  }
}

/**
 * Create a test database
 */
export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}
