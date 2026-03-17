// @nexus/orm - Module integration

import type { ConnectionOptions, DialectInterface } from "./types.js";
import { ConnectionManager, InMemoryConnection } from "./connection.js";
import { createDialect } from "./dialect.js";
import { MigrationRunner } from "./migration.js";
import { SeederRunner } from "./seeder.js";

/**
 * ORM module configuration
 */
export interface OrmModuleOptions {
  connections: Record<string, ConnectionOptions>;
  default?: string;
}

/**
 * ORM module - central orchestrator for database operations
 */
export class OrmModule {
  private readonly _connectionManager: ConnectionManager;
  private readonly _dialects: Map<string, DialectInterface> = new Map();
  private _migrationRunner: MigrationRunner | undefined;
  private _seederRunner: SeederRunner | undefined;

  constructor() {
    this._connectionManager = new ConnectionManager();
  }

  /**
   * Get the connection manager
   */
  get connections(): ConnectionManager {
    return this._connectionManager;
  }

  /**
   * Get or create a dialect
   */
  getDialect(name: "sqlite" | "postgres" | "mysql"): DialectInterface {
    if (!this._dialects.has(name)) {
      this._dialects.set(name, createDialect(name));
    }
    return this._dialects.get(name)!;
  }

  /**
   * Get the migration runner (creates one if needed)
   */
  getMigrationRunner(): MigrationRunner {
    if (!this._migrationRunner) {
      const conn = this._connectionManager.get();
      this._migrationRunner = new MigrationRunner(conn);
    }
    return this._migrationRunner;
  }

  /**
   * Get the seeder runner (creates one if needed)
   */
  getSeederRunner(): SeederRunner {
    if (!this._seederRunner) {
      const conn = this._connectionManager.get();
      this._seederRunner = new SeederRunner(conn);
    }
    return this._seederRunner;
  }

  /**
   * Set up an in-memory connection for testing
   */
  useInMemory(name = "default"): InMemoryConnection {
    const conn = new InMemoryConnection();
    this._connectionManager.register(name, conn);
    this._connectionManager.setDefault(name);
    return conn;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this._connectionManager.closeAll();
  }
}
