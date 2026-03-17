/**
 * User Service - Authentication Business Logic
 *
 * In @nexus/auth, user management is built into the auth module:
 *
 *   const auth = createAuth({
 *     strategy: 'jwt',
 *     userEntity: User,
 *     secret: config.auth.secret,
 *   });
 *
 *   // Registration with automatic password hashing
 *   const user = await auth.register({ email, password, name });
 *
 *   // Login with token generation
 *   const { user, token } = await auth.login({ email, password });
 *
 * This service demonstrates the same patterns implemented manually.
 */

import { getDatabase } from "../database/connection.js";
import {
  hashPassword,
  verifyPassword,
  createToken,
} from "../middleware/auth.js";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "../middleware/error-handler.js";
import { config } from "../config/app.config.js";
import {
  createUser,
  toUserProfile,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
  type User,
  type UserProfile,
} from "./user.model.js";

// ---------------------------------------------------------------------------
// UserService - handles registration, login, and user queries
// ---------------------------------------------------------------------------

export class UserService {
  /**
   * Register a new user.
   * - Validates email uniqueness
   * - Hashes password with random salt
   * - Returns auth response with JWT token
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const db = getDatabase();

    // Check for duplicate email
    const existing = db.users.findOne(
      (u) => u.email === input.email.toLowerCase().trim(),
    );
    if (existing) {
      throw new ConflictException(
        `User with email '${input.email}' already exists`,
      );
    }

    // Hash the password
    const { hash, salt } = await hashPassword(input.password);

    // Create and store the user
    const user = createUser(input, hash, salt);
    db.users.insert(user);

    // Generate JWT token
    const token = createToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: toUserProfile(user),
      token,
      expiresIn: config.auth.expiresInSeconds,
    };
  }

  /**
   * Authenticate a user with email and password.
   * - Finds user by email
   * - Verifies password against stored hash
   * - Updates lastLoginAt timestamp
   * - Returns auth response with JWT token
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const db = getDatabase();

    // Find user by email
    const user = db.users.findOne(
      (u) => u.email === input.email.toLowerCase().trim(),
    );
    if (!user) {
      // Use a generic message to prevent email enumeration
      throw new UnauthorizedException("Invalid email or password");
    }

    // Check if account is active
    if (!user.active) {
      throw new UnauthorizedException("Account is disabled");
    }

    // Verify password
    const isValid = await verifyPassword(
      input.password,
      user.passwordHash,
      user.salt,
    );
    if (!isValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Update last login timestamp
    const now = new Date().toISOString();
    db.users.update(user.id, { lastLoginAt: now });

    // Generate JWT token
    const token = createToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: toUserProfile({ ...user, lastLoginAt: now }),
      token,
      expiresIn: config.auth.expiresInSeconds,
    };
  }

  /**
   * Get a user's profile by ID.
   * Used by the GET /auth/me endpoint.
   */
  getProfile(userId: string): UserProfile {
    const db = getDatabase();
    const user = db.users.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return toUserProfile(user);
  }

  /**
   * Get the full user entity (internal use only).
   */
  findById(userId: string): User | null {
    const db = getDatabase();
    return db.users.findById(userId);
  }
}

// ---------------------------------------------------------------------------
// Singleton service instance
// ---------------------------------------------------------------------------

export const userService = new UserService();
