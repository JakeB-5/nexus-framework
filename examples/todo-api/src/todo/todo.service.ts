/**
 * Todo Service - Business Logic Layer
 *
 * In a Nexus application, services encapsulate business logic and are
 * registered in the DI container via @nexus/core:
 *
 *   @Injectable()
 *   class TodoService {
 *     constructor(
 *       private readonly todoRepo: Repository<Todo>,
 *       private readonly events: EventBus,
 *     ) {}
 *
 *     async create(input: CreateTodoInput, userId: string): Promise<Todo> {
 *       const todo = this.todoRepo.create({ ...input, userId });
 *       await this.todoRepo.save(todo);
 *       this.events.emit('todo.created', todo);
 *       return todo;
 *     }
 *   }
 *
 * This implementation uses the in-memory database directly,
 * demonstrating the same service patterns.
 */

import { getDatabase } from "../database/connection.js";
import { NotFoundException } from "../middleware/error-handler.js";
import {
  createTodo,
  applyTodoUpdate,
  TodoPriority,
  type CreateTodoInput,
  type PaginatedResponse,
  type Todo,
  type TodoQuery,
  type UpdateTodoInput,
} from "./todo.model.js";

// ---------------------------------------------------------------------------
// Priority sort ordering (for sorting by priority)
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = {
  [TodoPriority.Urgent]: 0,
  [TodoPriority.High]: 1,
  [TodoPriority.Medium]: 2,
  [TodoPriority.Low]: 3,
};

// ---------------------------------------------------------------------------
// TodoService - CRUD operations with filtering, sorting, and pagination
// ---------------------------------------------------------------------------

export class TodoService {
  /**
   * Create a new todo for the given user.
   * In @nexus/orm, this would be: await todoRepo.save(todoRepo.create(input))
   */
  create(input: CreateTodoInput, userId: string): Todo {
    const db = getDatabase();
    const todo = createTodo(input, userId);
    db.todos.insert(todo);
    return todo;
  }

  /**
   * Find all todos for a user with optional filtering, sorting, and pagination.
   * Demonstrates @nexus/orm query builder patterns:
   *
   *   const todos = await todoRepo
   *     .createQueryBuilder('t')
   *     .where('t.userId = :userId', { userId })
   *     .andWhere('t.status = :status', { status })
   *     .orderBy('t.createdAt', 'DESC')
   *     .skip(offset)
   *     .take(limit)
   *     .getManyAndCount();
   */
  findAll(userId: string, query: TodoQuery = {}): PaginatedResponse<Todo> {
    const db = getDatabase();

    // Step 1: Filter - get all todos for this user matching criteria
    let results = db.todos.findMany((todo) => {
      // Must belong to the requesting user
      if (todo.userId !== userId) return false;

      // Apply optional filters
      if (query.completed !== undefined && todo.completed !== query.completed) {
        return false;
      }
      if (query.status !== undefined && todo.status !== query.status) {
        return false;
      }
      if (query.priority !== undefined && todo.priority !== query.priority) {
        return false;
      }
      if (query.tag !== undefined && !todo.tags.includes(query.tag)) {
        return false;
      }

      // Text search in title and description
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        const titleMatch = todo.title.toLowerCase().includes(searchLower);
        const descMatch = todo.description?.toLowerCase().includes(searchLower) ?? false;
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });

    // Step 2: Sort
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";
    const orderMultiplier = sortOrder === "asc" ? 1 : -1;

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "priority":
          comparison = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          break;
        case "dueDate": {
          const aDate = a.dueDate ?? "9999-12-31";
          const bDate = b.dueDate ?? "9999-12-31";
          comparison = aDate.localeCompare(bDate);
          break;
        }
        case "updatedAt":
          comparison = a.updatedAt.localeCompare(b.updatedAt);
          break;
        case "createdAt":
        default:
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
      }

      return comparison * orderMultiplier;
    });

    // Step 3: Paginate
    const total = results.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    results = results.slice(offset, offset + limit);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find a single todo by ID, scoped to the requesting user.
   * Throws NotFoundException if not found or not owned by user.
   */
  findById(id: string, userId: string): Todo {
    const db = getDatabase();
    const todo = db.todos.findById(id);

    if (!todo || todo.userId !== userId) {
      throw new NotFoundException(`Todo with id '${id}' not found`);
    }

    return todo;
  }

  /**
   * Update a todo by ID.
   * Only the owner can update their todos.
   */
  update(id: string, input: UpdateTodoInput, userId: string): Todo {
    const db = getDatabase();
    const existing = this.findById(id, userId); // Throws if not found

    const updated = applyTodoUpdate(existing, input);
    db.todos.replace(id, updated);

    return updated;
  }

  /**
   * Delete a todo by ID.
   * Only the owner can delete their todos.
   */
  delete(id: string, userId: string): void {
    const db = getDatabase();
    // Verify ownership first
    this.findById(id, userId); // Throws if not found

    db.todos.delete(id);
  }

  /**
   * Get statistics for the user's todos.
   * Demonstrates aggregation queries.
   */
  getStats(userId: string): TodoStats {
    const db = getDatabase();
    const todos = db.todos.findMany((t) => t.userId === userId);

    const stats: TodoStats = {
      total: todos.length,
      completed: 0,
      pending: 0,
      inProgress: 0,
      cancelled: 0,
      byPriority: {
        [TodoPriority.Low]: 0,
        [TodoPriority.Medium]: 0,
        [TodoPriority.High]: 0,
        [TodoPriority.Urgent]: 0,
      },
      overdue: 0,
    };

    const now = new Date().toISOString();

    for (const todo of todos) {
      // Count by status
      switch (todo.status) {
        case "completed": stats.completed++; break;
        case "pending": stats.pending++; break;
        case "in_progress": stats.inProgress++; break;
        case "cancelled": stats.cancelled++; break;
      }

      // Count by priority
      stats.byPriority[todo.priority]++;

      // Count overdue (has due date, not completed, past due)
      if (todo.dueDate && !todo.completed && todo.dueDate < now) {
        stats.overdue++;
      }
    }

    return stats;
  }
}

// ---------------------------------------------------------------------------
// Stats response type
// ---------------------------------------------------------------------------

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  byPriority: Record<string, number>;
  overdue: number;
}

// ---------------------------------------------------------------------------
// Singleton service instance
// In @nexus/core, this is handled by the DI container automatically.
// ---------------------------------------------------------------------------

export const todoService = new TodoService();
