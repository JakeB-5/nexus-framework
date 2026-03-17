/**
 * Todo Request Validators
 *
 * In @nexus/validator, validation schemas are defined declaratively:
 *
 *   const createTodoSchema = schema({
 *     title: string().min(1).max(255).required(),
 *     description: string().max(1000).optional().nullable(),
 *     priority: enumOf(TodoPriority).optional(),
 *     tags: array(string().max(50)).max(10).optional(),
 *     dueDate: isoDate().optional().nullable(),
 *   });
 *
 *   // Usage in route:
 *   const data = await validate(createTodoSchema, req.body);
 *
 * This implementation provides the same validation logic
 * using plain functions, demonstrating the validation patterns.
 */

import {
  TodoPriority,
  TodoStatus,
  type CreateTodoInput,
  type TodoQuery,
  type UpdateTodoInput,
} from "./todo.model.js";
import {
  ValidationException,
  type ValidationError,
} from "../middleware/error-handler.js";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isValidISODate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
}

function isValidEnum<T extends string>(value: string, enumObj: Record<string, T>): boolean {
  return Object.values(enumObj).includes(value as T);
}

// ---------------------------------------------------------------------------
// Create Todo validation
// ---------------------------------------------------------------------------

export function validateCreateTodo(body: unknown): CreateTodoInput {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object") {
    throw new ValidationException("Request body must be a JSON object", [
      { field: "body", message: "Expected a JSON object" },
    ]);
  }

  const data = body as Record<string, unknown>;

  // title: required, string, 1-255 chars
  if (data.title === undefined || data.title === null) {
    errors.push({ field: "title", message: "Title is required" });
  } else if (!isString(data.title)) {
    errors.push({ field: "title", message: "Title must be a string", value: data.title });
  } else if (data.title.trim().length === 0) {
    errors.push({ field: "title", message: "Title cannot be empty" });
  } else if (data.title.length > 255) {
    errors.push({ field: "title", message: "Title must be at most 255 characters", value: data.title.length });
  }

  // description: optional, string or null, max 1000 chars
  if (data.description !== undefined && data.description !== null) {
    if (!isString(data.description)) {
      errors.push({ field: "description", message: "Description must be a string", value: data.description });
    } else if (data.description.length > 1000) {
      errors.push({ field: "description", message: "Description must be at most 1000 characters", value: data.description.length });
    }
  }

  // priority: optional, must be valid enum
  if (data.priority !== undefined) {
    if (!isString(data.priority) || !isValidEnum(data.priority, TodoPriority)) {
      errors.push({
        field: "priority",
        message: `Priority must be one of: ${Object.values(TodoPriority).join(", ")}`,
        value: data.priority,
      });
    }
  }

  // tags: optional, array of strings, max 10 items, each max 50 chars
  if (data.tags !== undefined) {
    if (!isArray(data.tags)) {
      errors.push({ field: "tags", message: "Tags must be an array" });
    } else {
      if (data.tags.length > 10) {
        errors.push({ field: "tags", message: "Maximum 10 tags allowed", value: data.tags.length });
      }
      for (let i = 0; i < data.tags.length; i++) {
        const tag = data.tags[i];
        if (!isString(tag)) {
          errors.push({ field: `tags[${i}]`, message: "Each tag must be a string" });
        } else if (tag.length > 50) {
          errors.push({ field: `tags[${i}]`, message: "Each tag must be at most 50 characters" });
        }
      }
    }
  }

  // dueDate: optional, valid ISO 8601 date string or null
  if (data.dueDate !== undefined && data.dueDate !== null) {
    if (!isString(data.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be a string" });
    } else if (!isValidISODate(data.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be a valid ISO 8601 date", value: data.dueDate });
    }
  }

  if (errors.length > 0) {
    throw new ValidationException("Validation failed", errors);
  }

  return {
    title: (data.title as string).trim(),
    description: data.description as string | undefined,
    priority: data.priority as TodoPriority | undefined,
    tags: data.tags as string[] | undefined,
    dueDate: data.dueDate as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Update Todo validation
// ---------------------------------------------------------------------------

export function validateUpdateTodo(body: unknown): UpdateTodoInput {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object") {
    throw new ValidationException("Request body must be a JSON object", [
      { field: "body", message: "Expected a JSON object" },
    ]);
  }

  const data = body as Record<string, unknown>;

  // At least one field must be provided
  const updateFields = [
    "title", "description", "completed", "status", "priority", "tags", "dueDate",
  ];
  const hasUpdate = updateFields.some((f) => data[f] !== undefined);
  if (!hasUpdate) {
    throw new ValidationException("At least one field must be provided for update", [
      { field: "body", message: `Provide at least one of: ${updateFields.join(", ")}` },
    ]);
  }

  // title: optional, string, 1-255 chars
  if (data.title !== undefined) {
    if (!isString(data.title)) {
      errors.push({ field: "title", message: "Title must be a string" });
    } else if (data.title.trim().length === 0) {
      errors.push({ field: "title", message: "Title cannot be empty" });
    } else if (data.title.length > 255) {
      errors.push({ field: "title", message: "Title must be at most 255 characters" });
    }
  }

  // description: optional, string or null
  if (data.description !== undefined && data.description !== null) {
    if (!isString(data.description)) {
      errors.push({ field: "description", message: "Description must be a string" });
    } else if (data.description.length > 1000) {
      errors.push({ field: "description", message: "Description must be at most 1000 characters" });
    }
  }

  // completed: optional, boolean
  if (data.completed !== undefined) {
    if (!isBoolean(data.completed)) {
      errors.push({ field: "completed", message: "Completed must be a boolean" });
    }
  }

  // status: optional, valid enum
  if (data.status !== undefined) {
    if (!isString(data.status) || !isValidEnum(data.status, TodoStatus)) {
      errors.push({
        field: "status",
        message: `Status must be one of: ${Object.values(TodoStatus).join(", ")}`,
        value: data.status,
      });
    }
  }

  // priority: optional, valid enum
  if (data.priority !== undefined) {
    if (!isString(data.priority) || !isValidEnum(data.priority, TodoPriority)) {
      errors.push({
        field: "priority",
        message: `Priority must be one of: ${Object.values(TodoPriority).join(", ")}`,
        value: data.priority,
      });
    }
  }

  // tags: optional, array of strings
  if (data.tags !== undefined) {
    if (!isArray(data.tags)) {
      errors.push({ field: "tags", message: "Tags must be an array" });
    } else {
      if (data.tags.length > 10) {
        errors.push({ field: "tags", message: "Maximum 10 tags allowed" });
      }
      for (let i = 0; i < data.tags.length; i++) {
        if (!isString(data.tags[i])) {
          errors.push({ field: `tags[${i}]`, message: "Each tag must be a string" });
        }
      }
    }
  }

  // dueDate: optional, valid ISO date or null
  if (data.dueDate !== undefined && data.dueDate !== null) {
    if (!isString(data.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be a string" });
    } else if (!isValidISODate(data.dueDate)) {
      errors.push({ field: "dueDate", message: "Due date must be a valid ISO 8601 date" });
    }
  }

  if (errors.length > 0) {
    throw new ValidationException("Validation failed", errors);
  }

  const result: UpdateTodoInput = {};
  if (data.title !== undefined) result.title = (data.title as string).trim();
  if (data.description !== undefined) result.description = data.description as string | null;
  if (data.completed !== undefined) result.completed = data.completed as boolean;
  if (data.status !== undefined) result.status = data.status as TodoStatus;
  if (data.priority !== undefined) result.priority = data.priority as TodoPriority;
  if (data.tags !== undefined) result.tags = data.tags as string[];
  if (data.dueDate !== undefined) result.dueDate = data.dueDate as string | null;

  return result;
}

// ---------------------------------------------------------------------------
// Query parameter validation
// ---------------------------------------------------------------------------

export function validateTodoQuery(params: URLSearchParams): TodoQuery {
  const query: TodoQuery = {};

  const completed = params.get("completed");
  if (completed !== null) {
    if (completed !== "true" && completed !== "false") {
      throw new ValidationException("Invalid query parameter", [
        { field: "completed", message: "Must be 'true' or 'false'", value: completed },
      ]);
    }
    query.completed = completed === "true";
  }

  const status = params.get("status");
  if (status !== null) {
    if (!isValidEnum(status, TodoStatus)) {
      throw new ValidationException("Invalid query parameter", [
        { field: "status", message: `Must be one of: ${Object.values(TodoStatus).join(", ")}`, value: status },
      ]);
    }
    query.status = status as TodoStatus;
  }

  const priority = params.get("priority");
  if (priority !== null) {
    if (!isValidEnum(priority, TodoPriority)) {
      throw new ValidationException("Invalid query parameter", [
        { field: "priority", message: `Must be one of: ${Object.values(TodoPriority).join(", ")}`, value: priority },
      ]);
    }
    query.priority = priority as TodoPriority;
  }

  const search = params.get("search");
  if (search !== null) {
    query.search = search;
  }

  const tag = params.get("tag");
  if (tag !== null) {
    query.tag = tag;
  }

  const sortBy = params.get("sortBy");
  if (sortBy !== null) {
    const validSorts = ["createdAt", "updatedAt", "dueDate", "priority", "title"];
    if (!validSorts.includes(sortBy)) {
      throw new ValidationException("Invalid query parameter", [
        { field: "sortBy", message: `Must be one of: ${validSorts.join(", ")}`, value: sortBy },
      ]);
    }
    query.sortBy = sortBy as TodoQuery["sortBy"];
  }

  const sortOrder = params.get("sortOrder");
  if (sortOrder !== null) {
    if (sortOrder !== "asc" && sortOrder !== "desc") {
      throw new ValidationException("Invalid query parameter", [
        { field: "sortOrder", message: "Must be 'asc' or 'desc'", value: sortOrder },
      ]);
    }
    query.sortOrder = sortOrder;
  }

  const page = params.get("page");
  if (page !== null) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new ValidationException("Invalid query parameter", [
        { field: "page", message: "Must be a positive integer", value: page },
      ]);
    }
    query.page = pageNum;
  }

  const limit = params.get("limit");
  if (limit !== null) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new ValidationException("Invalid query parameter", [
        { field: "limit", message: "Must be an integer between 1 and 100", value: limit },
      ]);
    }
    query.limit = limitNum;
  }

  return query;
}
