/**
 * User/Auth Request Validators
 *
 * In @nexus/validator, these would be schema definitions:
 *
 *   const registerSchema = schema({
 *     email: string().email().required(),
 *     password: string().min(8).max(128).required(),
 *     name: string().min(1).max(100).required(),
 *   });
 *
 *   const loginSchema = schema({
 *     email: string().email().required(),
 *     password: string().required(),
 *   });
 */

import type { LoginInput, RegisterInput } from "./user.model.js";
import {
  ValidationException,
  type ValidationError,
} from "../middleware/error-handler.js";

// ---------------------------------------------------------------------------
// Email validation regex (simplified but reasonable)
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ---------------------------------------------------------------------------
// Register validation
// ---------------------------------------------------------------------------

export function validateRegister(body: unknown): RegisterInput {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object") {
    throw new ValidationException("Request body must be a JSON object", [
      { field: "body", message: "Expected a JSON object" },
    ]);
  }

  const data = body as Record<string, unknown>;

  // email: required, valid email format
  if (!data.email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email must be a string" });
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.push({ field: "email", message: "Invalid email format", value: data.email });
  } else if (data.email.length > 255) {
    errors.push({ field: "email", message: "Email must be at most 255 characters" });
  }

  // password: required, 8-128 chars
  if (!data.password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password must be a string" });
  } else {
    if (data.password.length < 8) {
      errors.push({ field: "password", message: "Password must be at least 8 characters" });
    }
    if (data.password.length > 128) {
      errors.push({ field: "password", message: "Password must be at most 128 characters" });
    }
  }

  // name: required, 1-100 chars
  if (!data.name) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (typeof data.name !== "string") {
    errors.push({ field: "name", message: "Name must be a string" });
  } else if (data.name.trim().length === 0) {
    errors.push({ field: "name", message: "Name cannot be empty" });
  } else if (data.name.length > 100) {
    errors.push({ field: "name", message: "Name must be at most 100 characters" });
  }

  if (errors.length > 0) {
    throw new ValidationException("Validation failed", errors);
  }

  return {
    email: (data.email as string).toLowerCase().trim(),
    password: data.password as string,
    name: (data.name as string).trim(),
  };
}

// ---------------------------------------------------------------------------
// Login validation
// ---------------------------------------------------------------------------

export function validateLogin(body: unknown): LoginInput {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object") {
    throw new ValidationException("Request body must be a JSON object", [
      { field: "body", message: "Expected a JSON object" },
    ]);
  }

  const data = body as Record<string, unknown>;

  // email: required
  if (!data.email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email must be a string" });
  }

  // password: required
  if (!data.password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password must be a string" });
  }

  if (errors.length > 0) {
    throw new ValidationException("Validation failed", errors);
  }

  return {
    email: (data.email as string).toLowerCase().trim(),
    password: data.password as string,
  };
}
