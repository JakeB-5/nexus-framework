// @nexus/orm - Model base class

import type { DatabaseConnectionInterface, RelationDefinition, ModelHookType } from "./types.js";
import { QueryBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder } from "./query-builder.js";

/**
 * Model configuration
 */
export interface ModelConfig {
  tableName: string;
  primaryKey?: string;
  timestamps?: boolean;
  softDeletes?: boolean;
  connection?: DatabaseConnectionInterface;
}

/**
 * Model hook function type
 */
type HookFn = (data: Record<string, unknown>) => void | Promise<void>;

/**
 * Abstract base Model class
 */
export class Model {
  static tableName = "";
  static primaryKey = "id";
  static timestamps = true;
  static softDeletes = false;

  // Connection reference - set via configure()
  static _connection: DatabaseConnectionInterface | undefined;

  // Hooks registry
  private static _hooks: Map<ModelHookType, HookFn[]> = new Map();

  // Relationships
  private static _relations: Map<string, RelationDefinition> = new Map();

  /**
   * Configure the model with a connection
   */
  static configure(config: ModelConfig): void {
    this.tableName = config.tableName;
    if (config.primaryKey) this.primaryKey = config.primaryKey;
    if (config.timestamps !== undefined) this.timestamps = config.timestamps;
    if (config.softDeletes !== undefined) this.softDeletes = config.softDeletes;
    if (config.connection) this._connection = config.connection;
  }

  /**
   * Set the database connection
   */
  static setConnection(connection: DatabaseConnectionInterface): void {
    this._connection = connection;
  }

  /**
   * Find a record by primary key
   */
  static find(id: unknown): { toSQL: () => { sql: string; params: unknown[] } } {
    const qb = new QueryBuilder()
      .select("*")
      .from(this.tableName)
      .where(this.primaryKey, "=", id)
      .limit(1);

    if (this.softDeletes) {
      qb.whereNull("deleted_at");
    }

    return qb;
  }

  /**
   * Find many records matching conditions
   */
  static findMany(where?: Record<string, unknown>): QueryBuilder {
    const qb = new QueryBuilder().select("*").from(this.tableName);

    if (this.softDeletes) {
      qb.whereNull("deleted_at");
    }

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        qb.where(key, "=", value);
      }
    }

    return qb;
  }

  /**
   * Find one record matching conditions
   */
  static findOne(where: Record<string, unknown>): QueryBuilder {
    const qb = this.findMany(where).limit(1);
    return qb;
  }

  /**
   * Create a new record
   */
  static create(data: Record<string, unknown>): InsertBuilder {
    const insertData = { ...data };

    if (this.timestamps) {
      const now = new Date().toISOString();
      if (!insertData["created_at"]) insertData["created_at"] = now;
      if (!insertData["updated_at"]) insertData["updated_at"] = now;
    }

    return new InsertBuilder(this.tableName).values(insertData);
  }

  /**
   * Create multiple records
   */
  static createMany(data: Record<string, unknown>[]): InsertBuilder {
    const records = data.map((record) => {
      const insertData = { ...record };
      if (this.timestamps) {
        const now = new Date().toISOString();
        if (!insertData["created_at"]) insertData["created_at"] = now;
        if (!insertData["updated_at"]) insertData["updated_at"] = now;
      }
      return insertData;
    });

    return new InsertBuilder(this.tableName).values(records);
  }

  /**
   * Update a record by primary key
   */
  static update(id: unknown, data: Record<string, unknown>): UpdateBuilder {
    const updateData = { ...data };

    if (this.timestamps) {
      updateData["updated_at"] = new Date().toISOString();
    }

    return new UpdateBuilder(this.tableName)
      .set(updateData)
      .where(this.primaryKey, "=", id);
  }

  /**
   * Update multiple records matching conditions
   */
  static updateMany(where: Record<string, unknown>, data: Record<string, unknown>): UpdateBuilder {
    const updateData = { ...data };

    if (this.timestamps) {
      updateData["updated_at"] = new Date().toISOString();
    }

    const builder = new UpdateBuilder(this.tableName).set(updateData);

    for (const [key, value] of Object.entries(where)) {
      builder.where(key, "=", value);
    }

    return builder;
  }

  /**
   * Delete a record by primary key
   */
  static delete(id: unknown): UpdateBuilder | DeleteBuilder {
    if (this.softDeletes) {
      return new UpdateBuilder(this.tableName)
        .set({ deleted_at: new Date().toISOString() })
        .where(this.primaryKey, "=", id);
    }

    return new DeleteBuilder(this.tableName)
      .where(this.primaryKey, "=", id);
  }

  /**
   * Delete multiple records matching conditions
   */
  static deleteMany(where: Record<string, unknown>): UpdateBuilder | DeleteBuilder {
    if (this.softDeletes) {
      const builder = new UpdateBuilder(this.tableName)
        .set({ deleted_at: new Date().toISOString() });
      for (const [key, value] of Object.entries(where)) {
        builder.where(key, "=", value);
      }
      return builder;
    }

    const builder = new DeleteBuilder(this.tableName);
    for (const [key, value] of Object.entries(where)) {
      builder.where(key, "=", value);
    }
    return builder;
  }

  /**
   * Create a query builder for this model
   */
  static query(): QueryBuilder {
    const qb = new QueryBuilder().select("*").from(this.tableName);
    if (this.softDeletes) {
      qb.whereNull("deleted_at");
    }
    return qb;
  }

  // ---- Relationship definitions ----

  /**
   * Define a hasOne relationship
   */
  static hasOne(model: string, foreignKey: string, localKey?: string): RelationDefinition {
    const def: RelationDefinition = {
      type: "hasOne",
      model,
      foreignKey,
      localKey: localKey ?? this.primaryKey,
    };
    this._relations.set(model, def);
    return def;
  }

  /**
   * Define a hasMany relationship
   */
  static hasMany(model: string, foreignKey: string, localKey?: string): RelationDefinition {
    const def: RelationDefinition = {
      type: "hasMany",
      model,
      foreignKey,
      localKey: localKey ?? this.primaryKey,
    };
    this._relations.set(model, def);
    return def;
  }

  /**
   * Define a belongsTo relationship
   */
  static belongsTo(model: string, foreignKey: string, localKey?: string): RelationDefinition {
    const def: RelationDefinition = {
      type: "belongsTo",
      model,
      foreignKey,
      localKey: localKey ?? "id",
    };
    this._relations.set(model, def);
    return def;
  }

  /**
   * Define a belongsToMany relationship
   */
  static belongsToMany(
    model: string,
    pivotTable: string,
    pivotForeignKey: string,
    pivotLocalKey: string,
  ): RelationDefinition {
    const def: RelationDefinition = {
      type: "belongsToMany",
      model,
      foreignKey: pivotForeignKey,
      localKey: pivotLocalKey,
      pivotTable,
      pivotForeignKey,
      pivotLocalKey,
    };
    this._relations.set(model, def);
    return def;
  }

  /**
   * Get a relation definition
   */
  static getRelation(name: string): RelationDefinition | undefined {
    return this._relations.get(name);
  }

  // ---- Hooks ----

  /**
   * Register a hook
   */
  static addHook(type: ModelHookType, fn: HookFn): void {
    if (!this._hooks.has(type)) {
      this._hooks.set(type, []);
    }
    this._hooks.get(type)!.push(fn);
  }

  /**
   * Run hooks of a given type
   */
  static async runHooks(type: ModelHookType, data: Record<string, unknown>): Promise<void> {
    const hooks = this._hooks.get(type);
    if (hooks) {
      for (const hook of hooks) {
        await hook(data);
      }
    }
  }
}
