/**
 * Todo CRUD Tests
 *
 * Comprehensive tests for the Todo API endpoints including
 * CRUD operations, filtering, sorting, pagination, and validation.
 *
 * In @nexus/testing:
 *   const app = await createTestApp(TodoModule);
 *   const agent = app.agent(); // auto-manages auth tokens
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { initDatabase, resetDatabase } from "../src/database/connection.js";
import { handleRequest } from "../src/app.js";
import { TodoPriority, TodoStatus } from "../src/todo/todo.model.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      void handleRequest(req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const responseBody = text ? JSON.parse(text) : {};
  return { status: res.status, body: responseBody };
}

/** Register a user and return the auth token */
async function getAuthToken(
  email = "test@example.com",
  password = "password123",
  name = "Test User",
): Promise<string> {
  const res = await request("POST", "/auth/register", {
    email,
    password,
    name,
  });
  const data = res.body.data as Record<string, unknown>;
  return data.token as string;
}

/** Make an authenticated request */
async function authRequest(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return request(method, path, body, { Authorization: `Bearer ${token}` });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  resetDatabase();
  initDatabase();
  await startServer();
});

afterEach(async () => {
  await stopServer();
});

// ---------------------------------------------------------------------------
// Todo CRUD Tests
// ---------------------------------------------------------------------------

describe("Todo CRUD", () => {
  let token: string;

  beforeEach(async () => {
    token = await getAuthToken();
  });

  describe("POST /todos", () => {
    it("should create a todo with minimal fields", async () => {
      const res = await authRequest(token, "POST", "/todos", {
        title: "Buy groceries",
      });

      expect(res.status).toBe(201);
      const todo = (res.body.data as Record<string, unknown>);
      expect(todo.title).toBe("Buy groceries");
      expect(todo.completed).toBe(false);
      expect(todo.status).toBe("pending");
      expect(todo.priority).toBe("medium");
      expect(todo.id).toBeDefined();
      expect(todo.createdAt).toBeDefined();
    });

    it("should create a todo with all fields", async () => {
      const dueDate = new Date("2026-12-31T00:00:00.000Z").toISOString();
      const res = await authRequest(token, "POST", "/todos", {
        title: "Complete project",
        description: "Finish all remaining tasks",
        priority: "high",
        tags: ["work", "important"],
        dueDate,
      });

      expect(res.status).toBe(201);
      const todo = (res.body.data as Record<string, unknown>);
      expect(todo.title).toBe("Complete project");
      expect(todo.description).toBe("Finish all remaining tasks");
      expect(todo.priority).toBe("high");
      expect(todo.tags).toEqual(["work", "important"]);
      expect(todo.dueDate).toBe(dueDate);
    });

    it("should return 422 for missing title", async () => {
      const res = await authRequest(token, "POST", "/todos", {
        description: "No title here",
      });

      expect(res.status).toBe(422);
    });

    it("should return 422 for empty title", async () => {
      const res = await authRequest(token, "POST", "/todos", {
        title: "   ",
      });

      expect(res.status).toBe(422);
    });

    it("should return 422 for invalid priority", async () => {
      const res = await authRequest(token, "POST", "/todos", {
        title: "Bad priority",
        priority: "super-high",
      });

      expect(res.status).toBe(422);
    });

    it("should return 401 without auth token", async () => {
      const res = await request("POST", "/todos", {
        title: "No auth",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /todos", () => {
    beforeEach(async () => {
      // Create several todos for filtering/pagination tests
      await authRequest(token, "POST", "/todos", {
        title: "Alpha task",
        priority: "low",
        tags: ["alpha"],
      });
      await authRequest(token, "POST", "/todos", {
        title: "Beta task",
        priority: "high",
        tags: ["beta"],
      });
      await authRequest(token, "POST", "/todos", {
        title: "Gamma task",
        priority: "urgent",
        tags: ["gamma"],
        description: "This is a searchable description",
      });
    });

    it("should list all todos for the user", async () => {
      const res = await authRequest(token, "GET", "/todos");

      expect(res.status).toBe(200);
      const data = res.body.data as unknown[];
      expect(data).toHaveLength(3);
      expect(res.body.pagination).toBeDefined();
    });

    it("should return pagination metadata", async () => {
      const res = await authRequest(token, "GET", "/todos?limit=2&page=1");

      expect(res.status).toBe(200);
      const pagination = res.body.pagination as Record<string, unknown>;
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(2);
      expect(pagination.total).toBe(3);
      expect(pagination.totalPages).toBe(2);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(false);

      const data = res.body.data as unknown[];
      expect(data).toHaveLength(2);
    });

    it("should return page 2", async () => {
      const res = await authRequest(token, "GET", "/todos?limit=2&page=2");

      expect(res.status).toBe(200);
      const data = res.body.data as unknown[];
      expect(data).toHaveLength(1);
      const pagination = res.body.pagination as Record<string, unknown>;
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(true);
    });

    it("should filter by priority", async () => {
      const res = await authRequest(token, "GET", "/todos?priority=urgent");

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>[];
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Gamma task");
    });

    it("should filter by tag", async () => {
      const res = await authRequest(token, "GET", "/todos?tag=beta");

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>[];
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Beta task");
    });

    it("should search by title", async () => {
      const res = await authRequest(token, "GET", "/todos?search=alpha");

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>[];
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Alpha task");
    });

    it("should search in description", async () => {
      const res = await authRequest(token, "GET", "/todos?search=searchable");

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>[];
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Gamma task");
    });

    it("should sort by title ascending", async () => {
      const res = await authRequest(token, "GET", "/todos?sortBy=title&sortOrder=asc");

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>[];
      expect(data[0].title).toBe("Alpha task");
      expect(data[1].title).toBe("Beta task");
      expect(data[2].title).toBe("Gamma task");
    });

    it("should sort by priority", async () => {
      const res = await authRequest(token, "GET", "/todos?sortBy=priority&sortOrder=asc");

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>[];
      // Urgent (0) < High (1) < Low (3) in ascending order
      expect(data[0].priority).toBe("urgent");
      expect(data[1].priority).toBe("high");
      expect(data[2].priority).toBe("low");
    });

    it("should not return another user's todos", async () => {
      const otherToken = await getAuthToken("other@example.com", "password123", "Other");

      const res = await authRequest(otherToken, "GET", "/todos");

      expect(res.status).toBe(200);
      const data = res.body.data as unknown[];
      expect(data).toHaveLength(0);
    });

    it("should return 422 for invalid query params", async () => {
      const res = await authRequest(token, "GET", "/todos?priority=invalid");

      expect(res.status).toBe(422);
    });
  });

  describe("GET /todos/:id", () => {
    let todoId: string;

    beforeEach(async () => {
      const res = await authRequest(token, "POST", "/todos", {
        title: "Specific todo",
      });
      const data = res.body.data as Record<string, unknown>;
      todoId = data.id as string;
    });

    it("should return a specific todo", async () => {
      const res = await authRequest(token, "GET", `/todos/${todoId}`);

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.id).toBe(todoId);
      expect(data.title).toBe("Specific todo");
    });

    it("should return 404 for non-existent todo", async () => {
      const res = await authRequest(token, "GET", "/todos/non-existent-id");

      expect(res.status).toBe(404);
    });

    it("should return 404 for another user's todo", async () => {
      const otherToken = await getAuthToken("other2@example.com", "password123", "Other2");

      const res = await authRequest(otherToken, "GET", `/todos/${todoId}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /todos/:id", () => {
    let todoId: string;

    beforeEach(async () => {
      const res = await authRequest(token, "POST", "/todos", {
        title: "Update me",
        priority: "low",
      });
      const data = res.body.data as Record<string, unknown>;
      todoId = data.id as string;
    });

    it("should update the title", async () => {
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {
        title: "Updated title",
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.title).toBe("Updated title");
      expect(data.priority).toBe("low"); // unchanged
    });

    it("should mark as completed", async () => {
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {
        completed: true,
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.completed).toBe(true);
      expect(data.status).toBe(TodoStatus.Completed);
      expect(data.completedAt).toBeDefined();
    });

    it("should unmark completion", async () => {
      // First complete
      await authRequest(token, "PUT", `/todos/${todoId}`, { completed: true });

      // Then uncomplete
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {
        completed: false,
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.completed).toBe(false);
      expect(data.status).toBe(TodoStatus.Pending);
      expect(data.completedAt).toBeNull();
    });

    it("should update priority", async () => {
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {
        priority: TodoPriority.Urgent,
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.priority).toBe("urgent");
    });

    it("should update tags", async () => {
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {
        tags: ["new-tag", "another"],
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.tags).toEqual(["new-tag", "another"]);
    });

    it("should update description to null", async () => {
      // Set description
      await authRequest(token, "PUT", `/todos/${todoId}`, {
        description: "Some description",
      });

      // Clear it
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {
        description: null,
      });

      expect(res.status).toBe(200);
      const data = res.body.data as Record<string, unknown>;
      expect(data.description).toBeNull();
    });

    it("should return 422 when no fields provided", async () => {
      const res = await authRequest(token, "PUT", `/todos/${todoId}`, {});

      expect(res.status).toBe(422);
    });

    it("should return 404 for non-existent todo", async () => {
      const res = await authRequest(token, "PUT", "/todos/fake-id", {
        title: "Nope",
      });

      expect(res.status).toBe(404);
    });

    it("should return 404 for another user's todo", async () => {
      const otherToken = await getAuthToken("other3@example.com", "password123", "Other3");

      const res = await authRequest(otherToken, "PUT", `/todos/${todoId}`, {
        title: "Stolen",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /todos/:id", () => {
    let todoId: string;

    beforeEach(async () => {
      const res = await authRequest(token, "POST", "/todos", {
        title: "Delete me",
      });
      const data = res.body.data as Record<string, unknown>;
      todoId = data.id as string;
    });

    it("should delete a todo", async () => {
      const res = await authRequest(token, "DELETE", `/todos/${todoId}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await authRequest(token, "GET", `/todos/${todoId}`);
      expect(getRes.status).toBe(404);
    });

    it("should return 404 for non-existent todo", async () => {
      const res = await authRequest(token, "DELETE", "/todos/fake-id");

      expect(res.status).toBe(404);
    });

    it("should not allow deleting another user's todo", async () => {
      const otherToken = await getAuthToken("other4@example.com", "password123", "Other4");

      const res = await authRequest(otherToken, "DELETE", `/todos/${todoId}`);

      expect(res.status).toBe(404);

      // Verify it still exists for the original user
      const getRes = await authRequest(token, "GET", `/todos/${todoId}`);
      expect(getRes.status).toBe(200);
    });
  });

  describe("GET /todos/stats", () => {
    it("should return empty stats for new user", async () => {
      const res = await authRequest(token, "GET", "/todos/stats");

      expect(res.status).toBe(200);
      const stats = res.body.data as Record<string, unknown>;
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.pending).toBe(0);
    });

    it("should return accurate stats", async () => {
      // Create some todos
      await authRequest(token, "POST", "/todos", {
        title: "Low pending",
        priority: "low",
      });

      const createRes = await authRequest(token, "POST", "/todos", {
        title: "High todo",
        priority: "high",
      });
      const highTodoId = (createRes.body.data as Record<string, unknown>).id as string;

      await authRequest(token, "POST", "/todos", {
        title: "Urgent todo",
        priority: "urgent",
      });

      // Complete one
      await authRequest(token, "PUT", `/todos/${highTodoId}`, {
        completed: true,
      });

      const res = await authRequest(token, "GET", "/todos/stats");

      expect(res.status).toBe(200);
      const stats = res.body.data as Record<string, unknown>;
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(2);

      const byPriority = stats.byPriority as Record<string, number>;
      expect(byPriority.low).toBe(1);
      expect(byPriority.high).toBe(1);
      expect(byPriority.urgent).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Filter by completion status
// ---------------------------------------------------------------------------

describe("Todo Completion Filtering", () => {
  let token: string;

  beforeEach(async () => {
    token = await getAuthToken("filter@example.com", "password123", "Filter User");

    // Create completed and pending todos
    const res1 = await authRequest(token, "POST", "/todos", { title: "Done task" });
    const id1 = (res1.body.data as Record<string, unknown>).id as string;
    await authRequest(token, "PUT", `/todos/${id1}`, { completed: true });

    await authRequest(token, "POST", "/todos", { title: "Pending task" });
  });

  it("should filter completed todos", async () => {
    const res = await authRequest(token, "GET", "/todos?completed=true");

    expect(res.status).toBe(200);
    const data = res.body.data as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Done task");
  });

  it("should filter pending todos", async () => {
    const res = await authRequest(token, "GET", "/todos?completed=false");

    expect(res.status).toBe(200);
    const data = res.body.data as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Pending task");
  });

  it("should filter by status", async () => {
    const res = await authRequest(token, "GET", "/todos?status=completed");

    expect(res.status).toBe(200);
    const data = res.body.data as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// Error handling & edge cases
// ---------------------------------------------------------------------------

describe("Error Handling", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await request("GET", "/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("should return 404 for unsupported methods", async () => {
    const res = await request("PATCH", "/todos");

    expect(res.status).toBe(404);
  });

  it("should handle malformed JSON body", async () => {
    const token = await getAuthToken("json@example.com", "password123", "JSON User");

    const res = await fetch(`${baseUrl}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "{ invalid json }",
    });

    expect(res.status).toBe(400);
  });

  it("should handle CORS preflight", async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toBeDefined();
  });
});
