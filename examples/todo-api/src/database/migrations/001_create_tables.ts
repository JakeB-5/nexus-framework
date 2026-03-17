/**
 * Migration: Create Tables
 *
 * In @nexus/orm, migrations are defined with up/down methods:
 *
 *   export default defineMigration({
 *     name: '001_create_tables',
 *     async up(schema) {
 *       await schema.createTable('users', (t) => {
 *         t.uuid('id').primary();
 *         t.varchar('email', 255).unique().notNull();
 *         t.varchar('name', 255).notNull();
 *         t.varchar('password_hash', 512).notNull();
 *         t.varchar('salt', 128).notNull();
 *         t.enum('role', ['user', 'admin']).default('user');
 *         t.boolean('active').default(true);
 *         t.timestamps();
 *         t.timestamp('last_login_at').nullable();
 *       });
 *
 *       await schema.createTable('todos', (t) => {
 *         t.uuid('id').primary();
 *         t.varchar('title', 255).notNull();
 *         t.text('description').nullable();
 *         t.boolean('completed').default(false);
 *         t.enum('status', ['pending', 'in_progress', 'completed', 'cancelled']);
 *         t.enum('priority', ['low', 'medium', 'high', 'urgent']);
 *         t.uuid('user_id').references('users.id').onDelete('cascade');
 *         t.jsonb('tags').default('[]');
 *         t.timestamp('due_date').nullable();
 *         t.timestamps();
 *         t.timestamp('completed_at').nullable();
 *         t.index(['user_id', 'status']);
 *       });
 *     },
 *     async down(schema) {
 *       await schema.dropTable('todos');
 *       await schema.dropTable('users');
 *     },
 *   });
 *
 * For our in-memory database, tables are created implicitly when
 * collections are instantiated. This file serves as documentation
 * of the intended schema.
 */

import type { Database } from "../connection.js";

export interface Migration {
  name: string;
  up(db: Database): void;
  down(db: Database): void;
}

export const migration001: Migration = {
  name: "001_create_tables",

  up(_db: Database): void {
    // In-memory collections are created automatically in initDatabase().
    // This migration exists to document the schema structure.
    //
    // In a real database, this would execute:
    //   CREATE TABLE users (
    //     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    //     email VARCHAR(255) NOT NULL UNIQUE,
    //     name VARCHAR(255) NOT NULL,
    //     password_hash VARCHAR(512) NOT NULL,
    //     salt VARCHAR(128) NOT NULL,
    //     role VARCHAR(20) NOT NULL DEFAULT 'user',
    //     active BOOLEAN NOT NULL DEFAULT true,
    //     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    //     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    //     last_login_at TIMESTAMPTZ
    //   );
    //
    //   CREATE TABLE todos (
    //     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    //     title VARCHAR(255) NOT NULL,
    //     description TEXT,
    //     completed BOOLEAN NOT NULL DEFAULT false,
    //     status VARCHAR(20) NOT NULL DEFAULT 'pending',
    //     priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    //     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    //     tags JSONB NOT NULL DEFAULT '[]',
    //     due_date TIMESTAMPTZ,
    //     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    //     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    //     completed_at TIMESTAMPTZ
    //   );
    //
    //   CREATE INDEX idx_todos_user_status ON todos(user_id, status);
    console.log("[migration] 001_create_tables: up (no-op for in-memory db)");
  },

  down(_db: Database): void {
    // In a real database: DROP TABLE todos; DROP TABLE users;
    console.log("[migration] 001_create_tables: down (no-op for in-memory db)");
  },
};
