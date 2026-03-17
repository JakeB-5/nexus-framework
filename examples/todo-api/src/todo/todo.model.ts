/**
 * Todo Data Model
 *
 * In a Nexus application, models are defined using @nexus/orm decorators:
 *
 *   @Entity('todos')
 *   class Todo extends BaseEntity {
 *     @Column({ type: 'uuid', primary: true })
 *     id!: string;
 *
 *     @Column({ type: 'varchar', length: 255 })
 *     title!: string;
 *
 *     @BelongsTo(() => User)
 *     userId!: string;
 *   }
 *
 * Here we define the same structure as plain TypeScript interfaces and
 * a factory function, demonstrating the patterns without the ORM.
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Priority enum - demonstrates @nexus/orm enum column support
// ---------------------------------------------------------------------------

export enum TodoPriority {
  Low = "low",
  Medium = "medium",
  High = "high",
  Urgent = "urgent",
}

// ---------------------------------------------------------------------------
// Status enum - tracks todo lifecycle
// ---------------------------------------------------------------------------

export enum TodoStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Completed = "completed",
  Cancelled = "cancelled",
}

// ---------------------------------------------------------------------------
// Core Todo entity type
// ---------------------------------------------------------------------------

export interface Todo {
  /** Unique identifier (UUID v4) */
  id: string;
  /** The todo item title */
  title: string;
  /** Optional detailed description */
  description: string | null;
  /** Whether the todo is completed */
  completed: boolean;
  /** Current status */
  status: TodoStatus;
  /** Priority level */
  priority: TodoPriority;
  /** ID of the user who owns this todo */
  userId: string;
  /** Optional tags for categorization */
  tags: string[];
  /** Optional due date (ISO 8601) */
  dueDate: string | null;
  /** When the todo was created */
  createdAt: string;
  /** When the todo was last updated */
  updatedAt: string;
  /** When the todo was completed (null if not completed) */
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// DTO types - what the API accepts for create/update operations
// ---------------------------------------------------------------------------

/** Fields required to create a new todo */
export interface CreateTodoInput {
  title: string;
  description?: string | null;
  priority?: TodoPriority;
  tags?: string[];
  dueDate?: string | null;
}

/** Fields that can be updated on an existing todo */
export interface UpdateTodoInput {
  title?: string;
  description?: string | null;
  completed?: boolean;
  status?: TodoStatus;
  priority?: TodoPriority;
  tags?: string[];
  dueDate?: string | null;
}

/** Query parameters for listing todos */
export interface TodoQuery {
  /** Filter by completion status */
  completed?: boolean;
  /** Filter by status */
  status?: TodoStatus;
  /** Filter by priority */
  priority?: TodoPriority;
  /** Search in title and description */
  search?: string;
  /** Filter by tag */
  tag?: string;
  /** Sort field */
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "priority" | "title";
  /** Sort order */
  sortOrder?: "asc" | "desc";
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  limit?: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ---------------------------------------------------------------------------
// Factory function - creates a new Todo with sensible defaults
// In @nexus/orm, this would be handled by the entity's constructor/hooks.
// ---------------------------------------------------------------------------

export function createTodo(input: CreateTodoInput, userId: string): Todo {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? null,
    completed: false,
    status: TodoStatus.Pending,
    priority: input.priority ?? TodoPriority.Medium,
    userId,
    tags: input.tags ?? [],
    dueDate: input.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Update helper - applies partial updates and manages status transitions
// In @nexus/orm, this would be handled by @BeforeUpdate hooks.
// ---------------------------------------------------------------------------

export function applyTodoUpdate(todo: Todo, input: UpdateTodoInput): Todo {
  const now = new Date().toISOString();
  const updated = { ...todo, updatedAt: now };

  if (input.title !== undefined) updated.title = input.title;
  if (input.description !== undefined) updated.description = input.description;
  if (input.priority !== undefined) updated.priority = input.priority;
  if (input.tags !== undefined) updated.tags = input.tags;
  if (input.dueDate !== undefined) updated.dueDate = input.dueDate;

  // Handle completion state changes
  if (input.completed !== undefined) {
    updated.completed = input.completed;
    if (input.completed && !todo.completed) {
      updated.status = TodoStatus.Completed;
      updated.completedAt = now;
    } else if (!input.completed && todo.completed) {
      updated.status = TodoStatus.Pending;
      updated.completedAt = null;
    }
  }

  // Explicit status override takes precedence
  if (input.status !== undefined) {
    updated.status = input.status;
    updated.completed = input.status === TodoStatus.Completed;
    if (updated.completed && !todo.completed) {
      updated.completedAt = now;
    } else if (!updated.completed) {
      updated.completedAt = null;
    }
  }

  return updated;
}
