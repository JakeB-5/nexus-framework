/**
 * JWT Authentication Middleware
 *
 * In a Nexus application, @nexus/auth provides a complete auth system:
 *
 *   const auth = createAuth({
 *     strategy: 'jwt',
 *     secret: config.auth.secret,
 *     expiresIn: '24h',
 *   });
 *
 *   // Protect routes
 *   app.use('/api', auth.guard());
 *
 *   // Access current user
 *   const user = auth.getUser(req);
 *
 * This implementation uses node:crypto to create and verify JWTs
 * manually, demonstrating the underlying mechanics.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { config } from "../config/app.config.js";
import type { TokenPayload, UserRole } from "../user/user.model.js";
import { UnauthorizedException } from "./error-handler.js";

// ---------------------------------------------------------------------------
// Password hashing - mirrors @nexus/auth hashPassword / verifyPassword
// Uses HMAC-SHA256 with a random salt. In production, use bcrypt or argon2.
// ---------------------------------------------------------------------------

export interface HashedPassword {
  hash: string;
  salt: string;
}

/** Hash a plain-text password with a random salt */
export async function hashPassword(password: string): Promise<HashedPassword> {
  const salt = randomBytes(config.auth.saltLength).toString("hex");
  const hash = createHmac(config.auth.hashAlgorithm, salt)
    .update(password)
    .digest("hex");

  return { hash, salt };
}

/** Verify a password against a stored hash and salt */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): Promise<boolean> {
  const hash = createHmac(config.auth.hashAlgorithm, salt)
    .update(password)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (hashBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(hashBuffer, storedBuffer);
}

// ---------------------------------------------------------------------------
// JWT implementation - mirrors @nexus/auth JWT token management
// Manual implementation using HMAC-SHA256 signing.
// ---------------------------------------------------------------------------

/** Base64url encode (RFC 4648) */
function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Base64url decode */
function base64urlDecode(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString();
}

/** Sign data with HMAC-SHA256 */
function sign(input: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(input)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Create a JWT token for the given payload */
export function createToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + config.auth.expiresInSeconds,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${headerEncoded}.${payloadEncoded}`, config.auth.secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/** Verify and decode a JWT token */
export function verifyToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new UnauthorizedException("Malformed token");
  }

  const [headerEncoded, payloadEncoded, signature] = parts;

  // Verify signature
  const expectedSignature = sign(
    `${headerEncoded}.${payloadEncoded}`,
    config.auth.secret,
  );

  if (signature !== expectedSignature) {
    throw new UnauthorizedException("Invalid token signature");
  }

  // Decode payload
  const payload = JSON.parse(base64urlDecode(payloadEncoded)) as TokenPayload;

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new UnauthorizedException("Token expired");
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Auth context - attached to requests after authentication
// ---------------------------------------------------------------------------

/** Extended request with authenticated user context */
export interface AuthenticatedRequest extends IncomingMessage {
  user?: TokenPayload;
}

/** Extract and verify the JWT from the Authorization header */
export function authenticate(req: IncomingMessage): TokenPayload {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedException("Missing Authorization header");
  }

  // Expect "Bearer <token>" format
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    throw new UnauthorizedException(
      'Invalid Authorization header format. Expected: Bearer <token>',
    );
  }

  return verifyToken(match[1]);
}

/**
 * Auth guard middleware function.
 * Call this at the start of protected route handlers to get the user.
 *
 * Usage:
 *   const user = requireAuth(req);
 *   // user is guaranteed to be a valid TokenPayload
 */
export function requireAuth(req: IncomingMessage): TokenPayload {
  return authenticate(req);
}

/**
 * Optional auth - returns null if no token is present,
 * but still validates if a token IS provided.
 */
export function optionalAuth(req: IncomingMessage): TokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  return authenticate(req);
}

/**
 * Role-based access control.
 * Verifies the user has one of the required roles.
 *
 * In @nexus/auth:
 *   app.use('/admin', auth.guard({ roles: ['admin'] }));
 */
export function requireRole(
  user: TokenPayload,
  ...roles: UserRole[]
): void {
  if (!roles.includes(user.role)) {
    throw new UnauthorizedException(
      `Insufficient permissions. Required roles: ${roles.join(", ")}`,
    );
  }
}
