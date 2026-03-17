/**
 * In-Memory Database
 *
 * In a real Nexus application, @nexus/orm provides a database connection
 * manager that supports multiple drivers (PostgreSQL, MySQL, SQLite, etc.)
 * with connection pooling, migrations, and query building.
 *
 *   const db = createDatabase({
 *     driver: 'postgres',
 *     host: config.db.host,
 *     port: config.db.port,
 *     database: config.db.name,
 *   });
 *
 * For this example, we use an in-memory Map-based store that mimics
 * the same CRUD interface that @nexus/orm repositories provide.
 */

import type { Todo } from "../todo/todo.model.js";
import type { User } from "../user/user.model.js";

// ---------------------------------------------------------------------------
// Generic in-memory collection - mirrors @nexus/orm Repository<T>
// ---------------------------------------------------------------------------

export class Collection<T extends { id: string }> {
  private store = new Map<string, T>();

  /** Insert a new record */
  insert(record: T): T {
    if (this.store.has(record.id)) {
      throw new Error(`Duplicate key: ${record.id}`);
    }
    this.store.set(record.id, { ...record });
    return record;
  }

  /** Find a record by ID, returns null if not found */
  findById(id: string): T | null {
    const record = this.store.get(id);
    return record ? { ...record } : null;
  }

  /** Find a single record matching a predicate */
  findOne(predicate: (item: T) => boolean): T | null {
    for (const item of this.store.values()) {
      if (predicate(item)) return { ...item };
    }
    return null;
  }

  /** Find all records matching an optional predicate */
  findMany(predicate?: (item: T) => boolean): T[] {
    const results: T[] = [];
    for (const item of this.store.values()) {
      if (!predicate || predicate(item)) {
        results.push({ ...item });
      }
    }
    return results;
  }

  /** Count records matching an optional predicate */
  count(predicate?: (item: T) => boolean): number {
    if (!predicate) return this.store.size;
    let count = 0;
    for (const item of this.store.values()) {
      if (predicate(item)) count++;
    }
    return count;
  }

  /** Update a record by ID. Returns the updated record or null. */
  update(id: string, data: Partial<T>): T | null {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.store.set(id, updated);
    return { ...updated };
  }

  /** Replace a record entirely */
  replace(id: string, record: T): T | null {
    if (!this.store.has(id)) return null;
    this.store.set(id, { ...record });
    return { ...record };
  }

  /** Delete a record by ID. Returns true if it existed. */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  /** Clear all records */
  clear(): void {
    this.store.clear();
  }

  /** Get total number of records */
  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Database instance - holds all collections (tables)
// ---------------------------------------------------------------------------

export interface Database {
  users: Collection<User>;
  todos: Collection<Todo>;
}

/** Global database instance */
let db: Database | null = null;

/** Initialize the database (idempotent) */
export function initDatabase(): Database {
  if (db) return db;

  db = {
    users: new Collection<User>(),
    todos: new Collection<Todo>(),
  };

  return db;
}

/** Get the current database instance */
export function getDatabase(): Database {
  if (!db) {
    throw new Error(
      "Database not initialized. Call initDatabase() first.",
    );
  }
  return db;
}

/** Reset the database (useful for testing) */
export function resetDatabase(): void {
  if (db) {
    db.users.clear();
    db.todos.clear();
  }
  db = null;
}
