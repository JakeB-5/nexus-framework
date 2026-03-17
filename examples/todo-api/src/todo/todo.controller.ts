/**
 * Todo Controller - Route Handlers
 *
 * In a Nexus application, controllers use decorators to define routes:
 *
 *   @Controller('/todos')
 *   class TodoController {
 *     constructor(private readonly todoService: TodoService) {}
 *
 *     @Get('/')
 *     @Guard(AuthGuard)
 *     async list(@Query() query: TodoQuery, @User() user: TokenPayload) {
 *       return this.todoService.findAll(user.sub, query);
 *     }
 *
 *     @Post('/')
 *     @Guard(AuthGuard)
 *     @Validate(createTodoSchema)
 *     async create(@Body() input: CreateTodoInput, @User() user: TokenPayload) {
 *       return this.todoService.create(input, user.sub);
 *     }
 *   }
 *
 * Here we export plain handler functions that are wired up in the router.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuth } from "../middleware/auth.js";
import { sendJson } from "../middleware/error-handler.js";
import { todoService } from "./todo.service.js";
import { validateCreateTodo, validateUpdateTodo, validateTodoQuery } from "./todo.validator.js";
import { parseBody, parseUrlParams } from "../app.js";

// ---------------------------------------------------------------------------
// GET /todos - List all todos for the authenticated user
// Supports filtering, sorting, and pagination via query parameters.
// ---------------------------------------------------------------------------

export async function listTodos(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = requireAuth(req);
  const { searchParams } = parseUrlParams(req);
  const query = validateTodoQuery(searchParams);
  const result = todoService.findAll(user.sub, query);

  sendJson(res, 200, result);
}

// ---------------------------------------------------------------------------
// GET /todos/stats - Get todo statistics for the authenticated user
// ---------------------------------------------------------------------------

export async function getTodoStats(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = requireAuth(req);
  const stats = todoService.getStats(user.sub);

  sendJson(res, 200, { data: stats });
}

// ---------------------------------------------------------------------------
// GET /todos/:id - Get a single todo by ID
// ---------------------------------------------------------------------------

export async function getTodo(
  req: IncomingMessage,
  res: ServerResponse,
  todoId: string,
): Promise<void> {
  const user = requireAuth(req);
  const todo = todoService.findById(todoId, user.sub);

  sendJson(res, 200, { data: todo });
}

// ---------------------------------------------------------------------------
// POST /todos - Create a new todo
// ---------------------------------------------------------------------------

export async function createTodoHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = requireAuth(req);
  const body = await parseBody(req);
  const input = validateCreateTodo(body);
  const todo = todoService.create(input, user.sub);

  sendJson(res, 201, { data: todo });
}

// ---------------------------------------------------------------------------
// PUT /todos/:id - Update an existing todo
// ---------------------------------------------------------------------------

export async function updateTodo(
  req: IncomingMessage,
  res: ServerResponse,
  todoId: string,
): Promise<void> {
  const user = requireAuth(req);
  const body = await parseBody(req);
  const input = validateUpdateTodo(body);
  const todo = todoService.update(todoId, input, user.sub);

  sendJson(res, 200, { data: todo });
}

// ---------------------------------------------------------------------------
// DELETE /todos/:id - Delete a todo
// ---------------------------------------------------------------------------

export async function deleteTodo(
  req: IncomingMessage,
  res: ServerResponse,
  todoId: string,
): Promise<void> {
  const user = requireAuth(req);
  todoService.delete(todoId, user.sub);

  sendJson(res, 204, null);
}
