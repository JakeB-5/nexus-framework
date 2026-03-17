// @nexus/orm - Comprehensive tests

import { describe, it, expect, beforeEach } from "vitest";
import {
  QueryBuilder,
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
  raw,
  SchemaBuilder,
  TableBuilder,
  AlterTableBuilder,
  Model,
  InMemoryConnection,
  ConnectionManager,
  MigrationRunner,
  SeederRunner,
  SqliteDialect,
  PostgresDialect,
  MysqlDialect,
  createDialect,
  OrmModule,
  QueryError,
  ConnectionError,
  MigrationError,
  generateMigrationName,
} from "../src/index.js";
import type { Migration, Seeder } from "../src/index.js";

// ============================================================
// QUERY BUILDER - SELECT
// ============================================================
describe("QueryBuilder - SELECT", () => {
  it("builds basic select *", () => {
    const { sql, params } = new QueryBuilder().select().from("users").toSQL();
    expect(sql).toBe("SELECT * FROM users");
    expect(params).toEqual([]);
  });

  it("selects specific columns", () => {
    const { sql } = new QueryBuilder().select("id", "name", "email").from("users").toSQL();
    expect(sql).toBe("SELECT id, name, email FROM users");
  });

  it("supports DISTINCT", () => {
    const { sql } = new QueryBuilder().select("name").from("users").distinct().toSQL();
    expect(sql).toBe("SELECT DISTINCT name FROM users");
  });

  it("builds WHERE with = operator", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .where("id", "=", 1)
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(params).toEqual([1]);
  });

  it("supports WHERE shorthand (column, value)", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .where("name", "Alice")
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE name = ?");
    expect(params).toEqual(["Alice"]);
  });

  it("chains multiple WHERE conditions", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .where("age", ">=", 18)
      .where("active", "=", true)
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE age >= ? AND active = ?");
    expect(params).toEqual([18, true]);
  });

  it("supports OR WHERE", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .where("role", "admin")
      .orWhere("role", "superadmin")
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE role = ? OR role = ?");
    expect(params).toEqual(["admin", "superadmin"]);
  });

  it("supports WHERE IN", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .whereIn("id", [1, 2, 3])
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE id IN (?, ?, ?)");
    expect(params).toEqual([1, 2, 3]);
  });

  it("supports WHERE NOT IN", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .whereNotIn("status", ["banned", "deleted"])
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE status NOT IN (?, ?)");
    expect(params).toEqual(["banned", "deleted"]);
  });

  it("supports WHERE NULL", () => {
    const { sql } = new QueryBuilder()
      .select()
      .from("users")
      .whereNull("deleted_at")
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE deleted_at IS NULL");
  });

  it("supports WHERE NOT NULL", () => {
    const { sql } = new QueryBuilder()
      .select()
      .from("users")
      .whereNotNull("email")
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE email IS NOT NULL");
  });

  it("supports WHERE BETWEEN", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("products")
      .whereBetween("price", 10, 100)
      .toSQL();
    expect(sql).toBe("SELECT * FROM products WHERE price BETWEEN ? AND ?");
    expect(params).toEqual([10, 100]);
  });

  it("supports raw WHERE", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .where(raw("age > ? AND age < ?", [18, 65]))
      .toSQL();
    expect(sql).toBe("SELECT * FROM users WHERE age > ? AND age < ?");
    expect(params).toEqual([18, 65]);
  });

  it("builds INNER JOIN", () => {
    const { sql } = new QueryBuilder()
      .select("users.name", "orders.total")
      .from("users")
      .join("orders", "users.id = orders.user_id")
      .toSQL();
    expect(sql).toBe(
      "SELECT users.name, orders.total FROM users INNER JOIN orders ON users.id = orders.user_id",
    );
  });

  it("builds LEFT JOIN", () => {
    const { sql } = new QueryBuilder()
      .select()
      .from("users")
      .leftJoin("profiles", "users.id = profiles.user_id")
      .toSQL();
    expect(sql).toContain("LEFT JOIN profiles ON users.id = profiles.user_id");
  });

  it("builds RIGHT JOIN", () => {
    const { sql } = new QueryBuilder()
      .select()
      .from("users")
      .rightJoin("orders", "users.id = orders.user_id")
      .toSQL();
    expect(sql).toContain("RIGHT JOIN orders ON users.id = orders.user_id");
  });

  it("builds CROSS JOIN", () => {
    const { sql } = new QueryBuilder()
      .select()
      .from("colors")
      .crossJoin("sizes")
      .toSQL();
    expect(sql).toContain("CROSS JOIN sizes");
  });

  it("builds GROUP BY", () => {
    const { sql } = new QueryBuilder()
      .select("department", "COUNT(*) as count")
      .from("employees")
      .groupBy("department")
      .toSQL();
    expect(sql).toBe("SELECT department, COUNT(*) as count FROM employees GROUP BY department");
  });

  it("builds HAVING", () => {
    const { sql, params } = new QueryBuilder()
      .select("department", "COUNT(*) as count")
      .from("employees")
      .groupBy("department")
      .having("COUNT(*)", ">", 5)
      .toSQL();
    expect(sql).toContain("HAVING COUNT(*) > ?");
    expect(params).toEqual([5]);
  });

  it("builds ORDER BY", () => {
    const { sql } = new QueryBuilder()
      .select()
      .from("users")
      .orderBy("name", "ASC")
      .orderBy("age", "DESC")
      .toSQL();
    expect(sql).toContain("ORDER BY name ASC, age DESC");
  });

  it("builds LIMIT and OFFSET", () => {
    const { sql, params } = new QueryBuilder()
      .select()
      .from("users")
      .limit(10)
      .offset(20)
      .toSQL();
    expect(sql).toContain("LIMIT ?");
    expect(sql).toContain("OFFSET ?");
    expect(params).toEqual([10, 20]);
  });

  it("builds complex query", () => {
    const { sql, params } = new QueryBuilder()
      .select("u.name", "COUNT(o.id) as order_count")
      .from("users u")
      .leftJoin("orders o", "u.id = o.user_id")
      .where("u.active", "=", true)
      .groupBy("u.name")
      .having("COUNT(o.id)", ">", 0)
      .orderBy("order_count", "DESC")
      .limit(10)
      .toSQL();
    expect(sql).toContain("SELECT u.name, COUNT(o.id) as order_count");
    expect(sql).toContain("FROM users u");
    expect(sql).toContain("LEFT JOIN orders o ON u.id = o.user_id");
    expect(sql).toContain("WHERE u.active = ?");
    expect(sql).toContain("GROUP BY u.name");
    expect(sql).toContain("HAVING COUNT(o.id) > ?");
    expect(sql).toContain("ORDER BY order_count DESC");
    expect(sql).toContain("LIMIT ?");
    expect(params).toEqual([true, 0, 10]);
  });
});

// ============================================================
// QUERY BUILDER - INSERT
// ============================================================
describe("QueryBuilder - INSERT", () => {
  it("builds single row insert", () => {
    const { sql, params } = new InsertBuilder("users")
      .values({ name: "Alice", age: 30 })
      .toSQL();
    expect(sql).toBe("INSERT INTO users (name, age) VALUES (?, ?)");
    expect(params).toEqual(["Alice", 30]);
  });

  it("builds bulk insert", () => {
    const { sql, params } = new InsertBuilder("users")
      .values([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ])
      .toSQL();
    expect(sql).toBe("INSERT INTO users (name, age) VALUES (?, ?), (?, ?)");
    expect(params).toEqual(["Alice", 30, "Bob", 25]);
  });

  it("builds default values insert", () => {
    const { sql } = new InsertBuilder("users").toSQL();
    expect(sql).toBe("INSERT INTO users DEFAULT VALUES");
  });

  it("can be created from QueryBuilder", () => {
    const builder = new QueryBuilder().insert("users").values({ name: "Alice" });
    const { sql } = builder.toSQL();
    expect(sql).toContain("INSERT INTO users");
  });
});

// ============================================================
// QUERY BUILDER - UPDATE
// ============================================================
describe("QueryBuilder - UPDATE", () => {
  it("builds update with set and where", () => {
    const { sql, params } = new UpdateBuilder("users")
      .set({ name: "Bob", age: 26 })
      .where("id", "=", 1)
      .toSQL();
    expect(sql).toBe("UPDATE users SET name = ?, age = ? WHERE id = ?");
    expect(params).toEqual(["Bob", 26, 1]);
  });

  it("builds update without where", () => {
    const { sql, params } = new UpdateBuilder("users")
      .set({ active: false })
      .toSQL();
    expect(sql).toBe("UPDATE users SET active = ?");
    expect(params).toEqual([false]);
  });

  it("can chain set calls", () => {
    const { sql, params } = new UpdateBuilder("users")
      .set({ name: "Alice" })
      .set({ age: 30 })
      .where("id", 1)
      .toSQL();
    expect(sql).toContain("name = ?");
    expect(sql).toContain("age = ?");
    expect(params).toContain("Alice");
    expect(params).toContain(30);
  });
});

// ============================================================
// QUERY BUILDER - DELETE
// ============================================================
describe("QueryBuilder - DELETE", () => {
  it("builds delete with where", () => {
    const { sql, params } = new DeleteBuilder("users")
      .where("id", "=", 1)
      .toSQL();
    expect(sql).toBe("DELETE FROM users WHERE id = ?");
    expect(params).toEqual([1]);
  });

  it("builds delete without where", () => {
    const { sql, params } = new DeleteBuilder("users").toSQL();
    expect(sql).toBe("DELETE FROM users");
    expect(params).toEqual([]);
  });

  it("chains multiple where conditions", () => {
    const { sql, params } = new DeleteBuilder("logs")
      .where("created_at", "<", "2024-01-01")
      .where("level", "=", "debug")
      .toSQL();
    expect(sql).toBe("DELETE FROM logs WHERE created_at < ? AND level = ?");
    expect(params).toEqual(["2024-01-01", "debug"]);
  });
});

// ============================================================
// RAW SQL
// ============================================================
describe("raw()", () => {
  it("creates raw SQL expression", () => {
    const r = raw("NOW()");
    expect(r.__raw).toBe(true);
    expect(r.sql).toBe("NOW()");
    expect(r.bindings).toEqual([]);
  });

  it("creates raw SQL with bindings", () => {
    const r = raw("age > ? AND age < ?", [18, 65]);
    expect(r.bindings).toEqual([18, 65]);
  });
});

// ============================================================
// SCHEMA BUILDER - CREATE TABLE
// ============================================================
describe("SchemaBuilder - CREATE TABLE", () => {
  it("creates basic table", () => {
    const builder = new SchemaBuilder();
    builder.createTable("users", (t) => {
      t.id();
      t.varchar("name", 100).notNull();
      t.varchar("email").unique().notNull();
      t.integer("age");
      t.timestamps();
    });

    const stmts = builder.toSQL();
    expect(stmts.length).toBe(1);
    expect(stmts[0]).toContain("CREATE TABLE users");
    expect(stmts[0]).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(stmts[0]).toContain("name VARCHAR(100) NOT NULL");
    expect(stmts[0]).toContain("email VARCHAR(255) NOT NULL UNIQUE");
    expect(stmts[0]).toContain("age INTEGER");
    expect(stmts[0]).toContain("created_at");
    expect(stmts[0]).toContain("updated_at");
  });

  it("creates table with all column types", () => {
    const builder = new SchemaBuilder();
    builder.createTable("test", (t) => {
      t.integer("int_col");
      t.bigint("big_col");
      t.text("text_col");
      t.varchar("varchar_col", 50);
      t.boolean("bool_col");
      t.date("date_col");
      t.timestamp("ts_col");
      t.json("json_col");
      t.uuid("uuid_col");
      t.float("float_col");
      t.decimal("decimal_col", 10, 2);
      t.blob("blob_col");
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toContain("int_col INTEGER");
    expect(stmts[0]).toContain("big_col INTEGER");
    expect(stmts[0]).toContain("text_col TEXT");
    expect(stmts[0]).toContain("varchar_col VARCHAR(50)");
    expect(stmts[0]).toContain("bool_col INTEGER");
    expect(stmts[0]).toContain("uuid_col TEXT");
    expect(stmts[0]).toContain("float_col REAL");
    expect(stmts[0]).toContain("blob_col BLOB");
  });

  it("creates table with foreign key", () => {
    const builder = new SchemaBuilder();
    builder.createTable("orders", (t) => {
      t.id();
      t.integer("user_id").notNull().references("users", "id").onDelete("CASCADE");
      t.decimal("total");
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toContain("REFERENCES users(id)");
    expect(stmts[0]).toContain("ON DELETE CASCADE");
  });

  it("creates table with composite primary key", () => {
    const builder = new SchemaBuilder();
    builder.createTable("user_roles", (t) => {
      t.integer("user_id").notNull();
      t.integer("role_id").notNull();
      t.compositePrimaryKey("user_id", "role_id");
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toContain("PRIMARY KEY (user_id, role_id)");
  });

  it("creates table with check constraint", () => {
    const builder = new SchemaBuilder();
    builder.createTable("products", (t) => {
      t.id();
      t.decimal("price");
      t.check("price > 0");
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toContain("CHECK (price > 0)");
  });

  it("creates table with indexes", () => {
    const builder = new SchemaBuilder();
    builder.createTable("users", (t) => {
      t.id();
      t.varchar("email");
      t.index(["email"]);
      t.uniqueIndex(["email"], "idx_users_email_unique");
    });

    const stmts = builder.toSQL();
    expect(stmts.length).toBe(3); // CREATE TABLE + 2 indexes
    expect(stmts[1]).toContain("CREATE INDEX");
    expect(stmts[2]).toContain("CREATE UNIQUE INDEX idx_users_email_unique");
  });

  it("creates table with default values", () => {
    const builder = new SchemaBuilder();
    builder.createTable("settings", (t) => {
      t.id();
      t.varchar("key").notNull();
      t.text("value").default("empty");
      t.boolean("active").default(1);
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toContain("DEFAULT 'empty'");
    expect(stmts[0]).toContain("DEFAULT 1");
  });

  it("creates table with soft deletes", () => {
    const builder = new SchemaBuilder();
    builder.createTable("posts", (t) => {
      t.id();
      t.text("title");
      t.softDeletes();
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toContain("deleted_at");
  });
});

// ============================================================
// SCHEMA BUILDER - ALTER TABLE
// ============================================================
describe("SchemaBuilder - ALTER TABLE", () => {
  it("adds columns", () => {
    const builder = new SchemaBuilder();
    builder.alterTable("users", (t) => {
      t.addColumn("phone", "varchar", 20);
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toBe("ALTER TABLE users ADD COLUMN phone VARCHAR(20)");
  });

  it("drops columns", () => {
    const builder = new SchemaBuilder();
    builder.alterTable("users", (t) => {
      t.dropColumn("phone");
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toBe("ALTER TABLE users DROP COLUMN phone");
  });

  it("renames columns", () => {
    const builder = new SchemaBuilder();
    builder.alterTable("users", (t) => {
      t.renameColumn("name", "full_name");
    });

    const stmts = builder.toSQL();
    expect(stmts[0]).toBe("ALTER TABLE users RENAME COLUMN name TO full_name");
  });
});

// ============================================================
// SCHEMA BUILDER - DROP TABLE
// ============================================================
describe("SchemaBuilder - DROP TABLE", () => {
  it("drops a table", () => {
    const builder = new SchemaBuilder();
    builder.dropTable("users");
    expect(builder.toSQL()[0]).toBe("DROP TABLE users");
  });

  it("drops with cascade", () => {
    const builder = new SchemaBuilder();
    builder.dropTable("users", true);
    expect(builder.toSQL()[0]).toBe("DROP TABLE users CASCADE");
  });

  it("drops if exists", () => {
    const builder = new SchemaBuilder();
    builder.dropTableIfExists("users");
    expect(builder.toSQL()[0]).toBe("DROP TABLE IF EXISTS users");
  });

  it("renames a table", () => {
    const builder = new SchemaBuilder();
    builder.renameTable("users", "people");
    expect(builder.toSQL()[0]).toBe("ALTER TABLE users RENAME TO people");
  });
});

// ============================================================
// DIALECTS
// ============================================================
describe("Dialects", () => {
  it("SqliteDialect maps types correctly", () => {
    const d = new SqliteDialect();
    expect(d.columnTypeToSql("integer")).toBe("INTEGER");
    expect(d.columnTypeToSql("boolean")).toBe("INTEGER");
    expect(d.columnTypeToSql("json")).toBe("TEXT");
    expect(d.columnTypeToSql("uuid")).toBe("TEXT");
    expect(d.columnTypeToSql("varchar", 100)).toBe("VARCHAR(100)");
    expect(d.name).toBe("sqlite");
    expect(d.autoIncrementKeyword()).toBe("AUTOINCREMENT");
    expect(d.supportsReturning()).toBe(true);
  });

  it("PostgresDialect maps types correctly", () => {
    const d = new PostgresDialect();
    expect(d.columnTypeToSql("boolean")).toBe("BOOLEAN");
    expect(d.columnTypeToSql("json")).toBe("JSONB");
    expect(d.columnTypeToSql("uuid")).toBe("UUID");
    expect(d.columnTypeToSql("timestamp")).toBe("TIMESTAMP WITH TIME ZONE");
    expect(d.columnTypeToSql("decimal", undefined, 8, 2)).toBe("DECIMAL(8, 2)");
    expect(d.name).toBe("postgres");
    expect(d.supportsReturning()).toBe(true);
    expect(d.currentTimestamp()).toBe("NOW()");
  });

  it("MysqlDialect maps types correctly", () => {
    const d = new MysqlDialect();
    expect(d.columnTypeToSql("boolean")).toBe("TINYINT(1)");
    expect(d.columnTypeToSql("json")).toBe("JSON");
    expect(d.columnTypeToSql("uuid")).toBe("CHAR(36)");
    expect(d.name).toBe("mysql");
    expect(d.autoIncrementKeyword()).toBe("AUTO_INCREMENT");
    expect(d.supportsReturning()).toBe(false);
    expect(d.quoteIdentifier("name")).toBe("`name`");
  });

  it("createDialect factory works", () => {
    expect(createDialect("sqlite")).toBeInstanceOf(SqliteDialect);
    expect(createDialect("postgres")).toBeInstanceOf(PostgresDialect);
    expect(createDialect("mysql")).toBeInstanceOf(MysqlDialect);
  });
});

// ============================================================
// MODEL
// ============================================================
describe("Model", () => {
  class User extends Model {
    static override tableName = "users";
    static override primaryKey = "id";
    static override timestamps = true;
    static override softDeletes = false;
  }

  class Post extends Model {
    static override tableName = "posts";
    static override softDeletes = true;
  }

  it("generates find query", () => {
    const { sql, params } = User.find(1).toSQL();
    expect(sql).toContain("SELECT * FROM users");
    expect(sql).toContain("WHERE id = ?");
    expect(sql).toContain("LIMIT ?");
    expect(params).toContain(1);
  });

  it("generates findMany query", () => {
    const { sql, params } = User.findMany({ active: true }).toSQL();
    expect(sql).toContain("SELECT * FROM users");
    expect(sql).toContain("WHERE active = ?");
    expect(params).toEqual([true]);
  });

  it("generates findMany without conditions", () => {
    const { sql } = User.findMany().toSQL();
    expect(sql).toBe("SELECT * FROM users");
  });

  it("generates findOne query", () => {
    const { sql } = User.findOne({ email: "a@b.com" }).toSQL();
    expect(sql).toContain("WHERE email = ?");
    expect(sql).toContain("LIMIT ?");
  });

  it("generates create query with timestamps", () => {
    const { sql, params } = User.create({ name: "Alice" }).toSQL();
    expect(sql).toContain("INSERT INTO users");
    expect(sql).toContain("name");
    expect(sql).toContain("created_at");
    expect(sql).toContain("updated_at");
    expect(params[0]).toBe("Alice");
  });

  it("generates createMany query", () => {
    const { sql, params } = User.createMany([
      { name: "Alice" },
      { name: "Bob" },
    ]).toSQL();
    expect(sql).toContain("INSERT INTO users");
    expect(params).toContain("Alice");
    expect(params).toContain("Bob");
  });

  it("generates update query with timestamps", () => {
    const { sql, params } = User.update(1, { name: "Bob" }).toSQL();
    expect(sql).toContain("UPDATE users SET");
    expect(sql).toContain("name = ?");
    expect(sql).toContain("updated_at = ?");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toContain("Bob");
    expect(params).toContain(1);
  });

  it("generates updateMany query", () => {
    const { sql } = User.updateMany({ active: false }, { active: true }).toSQL();
    expect(sql).toContain("UPDATE users SET");
    expect(sql).toContain("WHERE active = ?");
  });

  it("generates hard delete query", () => {
    const result = User.delete(1);
    const { sql, params } = result.toSQL();
    expect(sql).toContain("DELETE FROM users");
    expect(sql).toContain("WHERE id = ?");
    expect(params).toContain(1);
  });

  it("generates soft delete query", () => {
    const result = Post.delete(1);
    const { sql } = result.toSQL();
    expect(sql).toContain("UPDATE posts SET");
    expect(sql).toContain("deleted_at");
    expect(sql).toContain("WHERE id = ?");
  });

  it("findMany excludes soft-deleted records", () => {
    const { sql } = Post.findMany().toSQL();
    expect(sql).toContain("deleted_at IS NULL");
  });

  it("supports custom query builder", () => {
    const { sql, params } = User.query()
      .where("age", ">", 18)
      .orderBy("name")
      .limit(10)
      .toSQL();
    expect(sql).toContain("SELECT * FROM users");
    expect(sql).toContain("WHERE age > ?");
    expect(sql).toContain("ORDER BY name ASC");
    expect(params).toContain(18);
  });

  it("defines hasOne relationship", () => {
    const rel = User.hasOne("profile", "user_id");
    expect(rel.type).toBe("hasOne");
    expect(rel.model).toBe("profile");
    expect(rel.foreignKey).toBe("user_id");
  });

  it("defines hasMany relationship", () => {
    const rel = User.hasMany("posts", "author_id");
    expect(rel.type).toBe("hasMany");
    expect(rel.foreignKey).toBe("author_id");
  });

  it("defines belongsTo relationship", () => {
    const rel = Post.belongsTo("user", "user_id");
    expect(rel.type).toBe("belongsTo");
  });

  it("defines belongsToMany relationship", () => {
    const rel = User.belongsToMany("roles", "user_roles", "role_id", "user_id");
    expect(rel.type).toBe("belongsToMany");
    expect(rel.pivotTable).toBe("user_roles");
  });

  it("registers and runs hooks", async () => {
    class HookUser extends Model {
      static override tableName = "hook_users";
    }
    const calls: string[] = [];
    HookUser.addHook("beforeCreate", async () => { calls.push("beforeCreate"); });
    HookUser.addHook("afterCreate", async () => { calls.push("afterCreate"); });

    await HookUser.runHooks("beforeCreate", { name: "test" });
    await HookUser.runHooks("afterCreate", { name: "test" });
    expect(calls).toEqual(["beforeCreate", "afterCreate"]);
  });
});

// ============================================================
// CONNECTION
// ============================================================
describe("InMemoryConnection", () => {
  let conn: InMemoryConnection;

  beforeEach(() => {
    conn = new InMemoryConnection();
  });

  it("is connected on creation", () => {
    expect(conn.isConnected()).toBe(true);
  });

  it("logs executed queries", async () => {
    await conn.execute("SELECT * FROM users");
    const log = conn.getQueryLog();
    expect(log.length).toBe(1);
    expect(log[0].sql).toBe("SELECT * FROM users");
  });

  it("clears query log", async () => {
    await conn.execute("SELECT 1");
    conn.clearQueryLog();
    expect(conn.getQueryLog().length).toBe(0);
  });

  it("handles CREATE TABLE", async () => {
    await conn.execute("CREATE TABLE users (id INTEGER, name TEXT)");
    expect(conn.hasTable("users")).toBe(true);
  });

  it("handles INSERT", async () => {
    await conn.execute("CREATE TABLE users (name TEXT, age INTEGER)");
    await conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Alice", 30]);
    const data = conn.getTableData("users");
    expect(data.length).toBe(1);
    expect(data[0]).toEqual({ name: "Alice", age: 30 });
  });

  it("handles DROP TABLE", async () => {
    await conn.execute("CREATE TABLE temp (id INTEGER)");
    expect(conn.hasTable("temp")).toBe(true);
    await conn.execute("DROP TABLE temp");
    expect(conn.hasTable("temp")).toBe(false);
  });

  it("handles transactions", async () => {
    await conn.execute("CREATE TABLE t (val INTEGER)");
    await conn.execute("INSERT INTO t (val) VALUES (?)", [1]);

    await conn.begin();
    expect(conn.inTransaction).toBe(true);
    await conn.execute("INSERT INTO t (val) VALUES (?)", [2]);
    await conn.rollback();
    expect(conn.inTransaction).toBe(false);

    // After rollback, table should be back to pre-transaction state
    const data = conn.getTableData("t");
    expect(data.length).toBe(1);
  });

  it("commit preserves changes", async () => {
    await conn.execute("CREATE TABLE t (val INTEGER)");
    await conn.begin();
    await conn.execute("INSERT INTO t (val) VALUES (?)", [1]);
    await conn.commit();

    const data = conn.getTableData("t");
    expect(data.length).toBe(1);
  });

  it("transaction helper commits on success", async () => {
    await conn.execute("CREATE TABLE t (x INTEGER)");
    await conn.transaction(async (c) => {
      await c.execute("INSERT INTO t (x) VALUES (?)", [42]);
    });
    expect(conn.getTableData("t").length).toBe(1);
  });

  it("transaction helper rolls back on error", async () => {
    await conn.execute("CREATE TABLE t (x INTEGER)");
    await conn.execute("INSERT INTO t (x) VALUES (?)", [1]);

    await expect(
      conn.transaction(async (c) => {
        await c.execute("INSERT INTO t (x) VALUES (?)", [2]);
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    expect(conn.getTableData("t").length).toBe(1);
  });

  it("throws when closed", async () => {
    await conn.close();
    expect(conn.isConnected()).toBe(false);
    await expect(conn.execute("SELECT 1")).rejects.toThrow(ConnectionError);
  });
});

describe("ConnectionManager", () => {
  it("registers and retrieves connections", () => {
    const manager = new ConnectionManager();
    const conn = new InMemoryConnection();
    manager.register("test", conn);
    expect(manager.get("test")).toBe(conn);
  });

  it("throws for unknown connection", () => {
    const manager = new ConnectionManager();
    expect(() => manager.get("missing")).toThrow(ConnectionError);
  });

  it("supports default connection", () => {
    const manager = new ConnectionManager();
    const conn = new InMemoryConnection();
    manager.register("default", conn);
    expect(manager.get()).toBe(conn);
  });

  it("checks existence", () => {
    const manager = new ConnectionManager();
    manager.register("db", new InMemoryConnection());
    expect(manager.has("db")).toBe(true);
    expect(manager.has("other")).toBe(false);
  });

  it("closes all connections", async () => {
    const manager = new ConnectionManager();
    const c1 = new InMemoryConnection();
    const c2 = new InMemoryConnection();
    manager.register("a", c1);
    manager.register("b", c2);

    await manager.closeAll();
    expect(c1.isConnected()).toBe(false);
    expect(c2.isConnected()).toBe(false);
  });

  it("createInMemory factory", () => {
    const { manager, connection } = ConnectionManager.createInMemory();
    expect(manager.get()).toBe(connection);
    expect(connection.isConnected()).toBe(true);
  });
});

// ============================================================
// MIGRATIONS
// ============================================================
describe("MigrationRunner", () => {
  let conn: InMemoryConnection;
  let runner: MigrationRunner;

  const migration1: Migration = {
    name: "20240101000000_create_users",
    up(builder) {
      builder.createTable("users", (t) => {
        t.id();
        t.varchar("name").notNull();
      });
    },
    down(builder) {
      builder.dropTable("users");
    },
  };

  const migration2: Migration = {
    name: "20240102000000_create_posts",
    up(builder) {
      builder.createTable("posts", (t) => {
        t.id();
        t.text("title");
        t.integer("user_id").references("users", "id");
      });
    },
    down(builder) {
      builder.dropTable("posts");
    },
  };

  beforeEach(() => {
    conn = new InMemoryConnection();
    runner = new MigrationRunner(conn);
    runner.registerMany([migration1, migration2]);
  });

  it("lists registered migrations", () => {
    expect(runner.getMigrationNames()).toEqual([
      "20240101000000_create_users",
      "20240102000000_create_posts",
    ]);
  });

  it("shows all pending initially", () => {
    expect(runner.getPending().length).toBe(2);
  });

  it("runs all pending migrations", async () => {
    const migrated = await runner.latest();
    expect(migrated).toEqual([
      "20240101000000_create_users",
      "20240102000000_create_posts",
    ]);
    expect(conn.hasTable("users")).toBe(true);
    expect(conn.hasTable("posts")).toBe(true);
  });

  it("returns empty when no pending", async () => {
    await runner.latest();
    const second = await runner.latest();
    expect(second).toEqual([]);
  });

  it("tracks executed migrations", async () => {
    await runner.latest();
    const executed = runner.getExecuted();
    expect(executed.length).toBe(2);
    expect(executed[0].batch).toBe(1);
  });

  it("rolls back last batch", async () => {
    await runner.latest();
    const rolledBack = await runner.rollback();
    expect(rolledBack).toEqual([
      "20240102000000_create_posts",
      "20240101000000_create_users",
    ]);
  });

  it("shows migration status", async () => {
    await runner.latest();
    const status = runner.status();
    expect(status[0].status).toBe("executed");
    expect(status[0].batch).toBe(1);
  });

  it("resets all migrations", async () => {
    await runner.latest();
    const reset = await runner.reset();
    expect(reset.length).toBe(2);
    expect(runner.getExecuted().length).toBe(0);
  });

  it("locks prevent concurrent runs", async () => {
    await runner.lock();
    await expect(runner.latest()).rejects.toThrow("Cannot acquire migration lock");
    await runner.unlock();
  });
});

describe("generateMigrationName", () => {
  it("generates timestamped name", () => {
    const name = generateMigrationName("create_users");
    expect(name).toMatch(/^\d{14}_create_users$/);
  });
});

// ============================================================
// SEEDER
// ============================================================
describe("SeederRunner", () => {
  it("runs all seeders", async () => {
    const conn = new InMemoryConnection();
    const runner = new SeederRunner(conn);
    const executed: string[] = [];

    const seeder: Seeder = {
      name: "UserSeeder",
      async run() {
        executed.push("UserSeeder");
      },
    };

    runner.register(seeder);
    const result = await runner.run();
    expect(result).toEqual(["UserSeeder"]);
    expect(executed).toEqual(["UserSeeder"]);
  });

  it("runs seeder by name", async () => {
    const conn = new InMemoryConnection();
    const runner = new SeederRunner(conn);
    let ran = false;

    runner.register({
      name: "TestSeeder",
      async run() { ran = true; },
    });

    await runner.runByName("TestSeeder");
    expect(ran).toBe(true);
  });

  it("throws for unknown seeder", async () => {
    const conn = new InMemoryConnection();
    const runner = new SeederRunner(conn);
    await expect(runner.runByName("Missing")).rejects.toThrow("not found");
  });

  it("lists seeder names", () => {
    const conn = new InMemoryConnection();
    const runner = new SeederRunner(conn);
    runner.registerMany([
      { name: "A", async run() {} },
      { name: "B", async run() {} },
    ]);
    expect(runner.getNames()).toEqual(["A", "B"]);
  });
});

// ============================================================
// ORM MODULE
// ============================================================
describe("OrmModule", () => {
  it("provides in-memory connection", () => {
    const orm = new OrmModule();
    const conn = orm.useInMemory();
    expect(conn.isConnected()).toBe(true);
    expect(orm.connections.get()).toBe(conn);
  });

  it("provides dialects", () => {
    const orm = new OrmModule();
    expect(orm.getDialect("sqlite")).toBeInstanceOf(SqliteDialect);
    expect(orm.getDialect("postgres")).toBeInstanceOf(PostgresDialect);
  });

  it("provides migration runner", () => {
    const orm = new OrmModule();
    orm.useInMemory();
    expect(orm.getMigrationRunner()).toBeInstanceOf(MigrationRunner);
  });

  it("provides seeder runner", () => {
    const orm = new OrmModule();
    orm.useInMemory();
    expect(orm.getSeederRunner()).toBeInstanceOf(SeederRunner);
  });

  it("closes all connections", async () => {
    const orm = new OrmModule();
    const conn = orm.useInMemory();
    await orm.close();
    expect(conn.isConnected()).toBe(false);
  });
});

// ============================================================
// ERRORS
// ============================================================
describe("ORM Errors", () => {
  it("QueryError has correct code", () => {
    const err = new QueryError("bad query");
    expect(err.code).toBe("QUERY_ERROR");
    expect(err.name).toBe("QueryError");
    expect(err.message).toBe("bad query");
  });

  it("ConnectionError has correct code", () => {
    const err = new ConnectionError("no connection");
    expect(err.code).toBe("CONNECTION_ERROR");
    expect(err.name).toBe("ConnectionError");
  });

  it("MigrationError includes migration name", () => {
    const err = new MigrationError("create_users", "failed");
    expect(err.migrationName).toBe("create_users");
    expect(err.code).toBe("MIGRATION_ERROR");
    expect(err.context).toEqual({ migration: "create_users" });
  });

  it("MigrationError has default message", () => {
    const err = new MigrationError("create_users");
    expect(err.message).toContain("create_users");
  });
});
