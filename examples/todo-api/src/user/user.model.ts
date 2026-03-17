/**
 * User Data Model
 *
 * Demonstrates the user entity pattern used in @nexus/auth.
 * In a real Nexus app, the auth module provides a base User entity
 * with built-in password hashing, role management, and session tracking.
 *
 *   @Entity('users')
 *   class User extends AuthenticableEntity {
 *     @Column({ type: 'varchar', unique: true })
 *     email!: string;
 *
 *     @HasMany(() => Todo)
 *     todos!: Todo[];
 *   }
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// User role enum
// ---------------------------------------------------------------------------

export enum UserRole {
  User = "user",
  Admin = "admin",
}

// ---------------------------------------------------------------------------
// Core User entity
// ---------------------------------------------------------------------------

export interface User {
  /** Unique identifier (UUID v4) */
  id: string;
  /** User's email address (unique) */
  email: string;
  /** User's display name */
  name: string;
  /** Hashed password (never exposed in API responses) */
  passwordHash: string;
  /** Salt used for password hashing */
  salt: string;
  /** User's role */
  role: UserRole;
  /** Whether the account is active */
  active: boolean;
  /** When the user registered */
  createdAt: string;
  /** When the user profile was last updated */
  updatedAt: string;
  /** When the user last logged in */
  lastLoginAt: string | null;
}

// ---------------------------------------------------------------------------
// Public user profile - safe to return in API responses
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

/** Fields required for user registration */
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

/** Fields required for login */
export interface LoginInput {
  email: string;
  password: string;
}

/** JWT token payload */
export interface TokenPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  iat: number; // issued at (epoch seconds)
  exp: number; // expires at (epoch seconds)
}

/** Auth response returned after login/register */
export interface AuthResponse {
  user: UserProfile;
  token: string;
  expiresIn: number;
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

export function createUser(
  input: RegisterInput,
  passwordHash: string,
  salt: string,
): User {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    email: input.email.toLowerCase().trim(),
    name: input.name.trim(),
    passwordHash,
    salt,
    role: UserRole.User,
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
}

// ---------------------------------------------------------------------------
// Projection helper - strips sensitive fields for API responses
// In @nexus/orm this is handled by @Hidden() decorator on sensitive columns.
// ---------------------------------------------------------------------------

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
