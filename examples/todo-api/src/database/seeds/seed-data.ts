/**
 * Seed Data
 *
 * In @nexus/orm, seeds are used to populate the database with
 * initial or test data:
 *
 *   export default defineSeed({
 *     name: 'initial-data',
 *     async run(db) {
 *       await db.users.create({ ... });
 *       await db.todos.createMany([...]);
 *     },
 *   });
 *
 * This seeder creates a demo user and a set of sample todos.
 */

import { hashPassword } from "../../middleware/auth.js";
import { createTodo, TodoPriority } from "../../todo/todo.model.js";
import { createUser } from "../../user/user.model.js";
import type { Database } from "../connection.js";

// ---------------------------------------------------------------------------
// Sample data definitions
// ---------------------------------------------------------------------------

const DEMO_USER = {
  email: "demo@example.com",
  password: "demo1234",
  name: "Demo User",
};

const SAMPLE_TODOS = [
  {
    title: "Set up project structure",
    description: "Initialize the monorepo with Turbo, configure TypeScript, and set up workspace packages.",
    priority: TodoPriority.High,
    tags: ["setup", "infrastructure"],
  },
  {
    title: "Implement authentication",
    description: "Add JWT-based auth with register, login, and token refresh endpoints.",
    priority: TodoPriority.High,
    tags: ["auth", "security"],
  },
  {
    title: "Create database models",
    description: "Define entity models for User and Todo with proper relationships.",
    priority: TodoPriority.Medium,
    tags: ["database", "models"],
  },
  {
    title: "Add request validation",
    description: "Implement schema-based validation for all API endpoints.",
    priority: TodoPriority.Medium,
    tags: ["validation", "api"],
  },
  {
    title: "Write unit tests",
    description: "Add comprehensive test coverage for services and controllers.",
    priority: TodoPriority.Medium,
    tags: ["testing"],
  },
  {
    title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for automated testing and deployment.",
    priority: TodoPriority.Low,
    tags: ["devops", "infrastructure"],
    dueDate: "2026-04-01T00:00:00.000Z",
  },
  {
    title: "Add API documentation",
    description: "Generate OpenAPI spec and set up Swagger UI.",
    priority: TodoPriority.Low,
    tags: ["docs", "api"],
  },
  {
    title: "Performance optimization",
    description: "Add caching, connection pooling, and query optimization.",
    priority: TodoPriority.Low,
    tags: ["performance"],
    dueDate: "2026-05-01T00:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

export async function seedDatabase(db: Database): Promise<void> {
  console.log("[seed] Seeding database with sample data...");

  // Create demo user
  const { hash, salt } = await hashPassword(DEMO_USER.password);
  const user = createUser(
    {
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      name: DEMO_USER.name,
    },
    hash,
    salt,
  );
  db.users.insert(user);
  console.log(`[seed] Created demo user: ${user.email} (id: ${user.id})`);

  // Create sample todos
  for (const todoInput of SAMPLE_TODOS) {
    const todo = createTodo(todoInput, user.id);
    db.todos.insert(todo);
  }
  console.log(`[seed] Created ${SAMPLE_TODOS.length} sample todos`);

  console.log("[seed] Database seeding complete.");
  console.log(`[seed] Login with: email=${DEMO_USER.email} password=${DEMO_USER.password}`);
}
