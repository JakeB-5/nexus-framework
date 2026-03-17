// @nexus/orm - Migration system

import type { Migration, MigrationStatus, DatabaseConnectionInterface } from "./types.js";
import { MigrationError } from "./errors.js";
import { SchemaBuilder } from "./schema-builder.js";

/**
 * Migration runner - manages executing and rolling back migrations
 */
export class MigrationRunner {
  private readonly _migrations: Migration[] = [];
  private _currentBatch = 0;
  private readonly _executed: MigrationStatus[] = [];
  private _locked = false;

  constructor(private readonly _connection: DatabaseConnectionInterface) {}

  /**
   * Register a migration
   */
  register(migration: Migration): void {
    this._migrations.push(migration);
  }

  /**
   * Register multiple migrations
   */
  registerMany(migrations: Migration[]): void {
    this._migrations.push(...migrations);
  }

  /**
   * Get all registered migration names
   */
  getMigrationNames(): string[] {
    return this._migrations.map((m) => m.name);
  }

  /**
   * Get already executed migrations
   */
  getExecuted(): MigrationStatus[] {
    return [...this._executed];
  }

  /**
   * Get pending (not yet executed) migrations
   */
  getPending(): Migration[] {
    const executedNames = new Set(this._executed.map((m) => m.name));
    return this._migrations.filter((m) => !executedNames.has(m.name));
  }

  /**
   * Acquire migration lock
   */
  async lock(): Promise<boolean> {
    if (this._locked) return false;
    this._locked = true;
    return true;
  }

  /**
   * Release migration lock
   */
  async unlock(): Promise<void> {
    this._locked = false;
  }

  /**
   * Run all pending migrations
   */
  async latest(): Promise<string[]> {
    const locked = await this.lock();
    if (!locked) {
      throw new MigrationError("migrations", "Cannot acquire migration lock");
    }

    try {
      const pending = this.getPending();
      if (pending.length === 0) return [];

      this._currentBatch++;
      const migrated: string[] = [];

      for (const migration of pending) {
        try {
          const builder = new SchemaBuilder();
          migration.up(builder);

          // Execute all DDL statements
          for (const sql of builder.toSQL()) {
            await this._connection.execute(sql);
          }

          this._executed.push({
            name: migration.name,
            batch: this._currentBatch,
            executedAt: new Date(),
          });

          migrated.push(migration.name);
        } catch (error) {
          throw new MigrationError(
            migration.name,
            `Failed to run migration: ${migration.name}`,
            { cause: error instanceof Error ? error : undefined },
          );
        }
      }

      return migrated;
    } finally {
      await this.unlock();
    }
  }

  /**
   * Rollback the last batch of migrations
   */
  async rollback(): Promise<string[]> {
    const locked = await this.lock();
    if (!locked) {
      throw new MigrationError("migrations", "Cannot acquire migration lock");
    }

    try {
      if (this._executed.length === 0) return [];

      const lastBatch = this._currentBatch;
      const toRollback = this._executed
        .filter((m) => m.batch === lastBatch)
        .reverse();

      if (toRollback.length === 0) return [];

      const rolledBack: string[] = [];

      for (const status of toRollback) {
        const migration = this._migrations.find((m) => m.name === status.name);
        if (!migration) {
          throw new MigrationError(
            status.name,
            `Migration not found: ${status.name}`,
          );
        }

        try {
          const builder = new SchemaBuilder();
          migration.down(builder);

          for (const sql of builder.toSQL()) {
            await this._connection.execute(sql);
          }

          // Remove from executed
          const idx = this._executed.findIndex((m) => m.name === status.name);
          if (idx !== -1) this._executed.splice(idx, 1);

          rolledBack.push(status.name);
        } catch (error) {
          throw new MigrationError(
            status.name,
            `Failed to rollback migration: ${status.name}`,
            { cause: error instanceof Error ? error : undefined },
          );
        }
      }

      this._currentBatch--;
      return rolledBack;
    } finally {
      await this.unlock();
    }
  }

  /**
   * Get migration status
   */
  status(): Array<{ name: string; status: "pending" | "executed"; batch?: number; executedAt?: Date }> {
    const executedMap = new Map(this._executed.map((m) => [m.name, m]));

    return this._migrations.map((migration) => {
      const executed = executedMap.get(migration.name);
      if (executed) {
        return {
          name: migration.name,
          status: "executed" as const,
          batch: executed.batch,
          executedAt: executed.executedAt,
        };
      }
      return {
        name: migration.name,
        status: "pending" as const,
      };
    });
  }

  /**
   * Reset - rollback all migrations
   */
  async reset(): Promise<string[]> {
    const allRolledBack: string[] = [];
    while (this._executed.length > 0) {
      const batch = await this.rollback();
      allRolledBack.push(...batch);
    }
    return allRolledBack;
  }
}

/**
 * Generate a migration name with timestamp
 */
export function generateMigrationName(description: string): string {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `${timestamp}_${description}`;
}
