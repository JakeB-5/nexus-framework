// @nexus/security - CSRF protection middleware

import * as crypto from "node:crypto";
import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";
import type { CsrfOptions, SecurityMiddleware } from "./types.js";
import { CsrfError } from "./errors.js";

const DEFAULT_PROTECTED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Create CSRF protection middleware using double-submit cookie pattern
 */
export function csrf(options: CsrfOptions = {}): SecurityMiddleware {
  const {
    cookieName = "_csrf",
    headerName = "x-csrf-token",
    fieldName = "_csrf",
    tokenLength = 32,
    protectedMethods = DEFAULT_PROTECTED_METHODS,
    excludePaths = [],
    cookie = {},
  } = options;

  const cookieOptions = {
    httpOnly: cookie.httpOnly ?? true,
    secure: cookie.secure ?? false,
    sameSite: cookie.sameSite ?? ("Lax" as const),
    path: cookie.path ?? "/",
  };

  return async (req: NexusRequestInterface, res: NexusResponseInterface, next: NextFunction): Promise<void> => {
    // Get or create the CSRF token from cookie
    let token = req.cookies[cookieName];

    if (!token) {
      // Generate new token and set cookie
      token = generateCsrfToken(tokenLength);
      res.cookie(cookieName, token, {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
      });
    }

    // Expose token on request for template rendering
    (req as unknown as Record<string, string>).csrfToken = token;

    // Check if method requires validation
    if (!protectedMethods.includes(req.method)) {
      next();
      return;
    }

    // Check path exclusions
    if (excludePaths.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }

    // Validate token from header or body field
    const headerToken = req.get(headerName);

    // Try header first, then body field
    let submittedToken = headerToken;
    if (!submittedToken) {
      try {
        const body = await req.body() as Record<string, unknown> | null;
        if (body && typeof body === "object" && fieldName in body) {
          submittedToken = String(body[fieldName]);
        }
      } catch {
        // Body parse failure - no token from body
      }
    }

    if (!submittedToken || !safeCompare(token, submittedToken)) {
      next(new CsrfError());
      return;
    }

    next();
  };
}
