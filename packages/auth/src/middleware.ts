// Auth middleware functions

import { AuthenticationError, AuthorizationError } from "./errors.js";
import type { Guard } from "./guards.js";
import type { RBAC } from "./rbac.js";
import type {
  AuthContext,
  AuthMiddleware,
  AuthRequest,
  AuthResponse,
  AuthUser,
  NextFunction,
} from "./types.js";

// Augment request with auth context via a WeakMap
const authContexts = new WeakMap<AuthRequest, AuthContext>();

export function getAuthContext(req: AuthRequest): AuthContext | undefined {
  return authContexts.get(req);
}

export function setAuthContext(req: AuthRequest, context: AuthContext): void {
  authContexts.set(req, context);
}

export function authenticate(guard: Guard, optional = false): AuthMiddleware {
  return async (
    req: AuthRequest,
    _res: AuthResponse,
    next: NextFunction,
  ): Promise<void> => {
    const result = await guard.authenticate(req);

    if (result.authenticated && result.user) {
      setAuthContext(req, {
        user: result.user,
        token: result.token,
      });
    } else if (!optional) {
      throw new AuthenticationError(result.error ?? "Authentication failed");
    }

    await next();
  };
}

export function authorize(
  rbac: RBAC,
  ...permissions: string[]
): AuthMiddleware {
  return async (
    req: AuthRequest,
    _res: AuthResponse,
    next: NextFunction,
  ): Promise<void> => {
    const context = getAuthContext(req);
    if (!context?.user) {
      throw new AuthenticationError("Authentication required");
    }

    for (const permission of permissions) {
      if (!rbac.can(context.user, permission)) {
        throw new AuthorizationError(
          `Missing permission: ${permission}`,
        );
      }
    }

    await next();
  };
}

export function requireRole(...roles: string[]): AuthMiddleware {
  return async (
    req: AuthRequest,
    _res: AuthResponse,
    next: NextFunction,
  ): Promise<void> => {
    const context = getAuthContext(req);
    if (!context?.user) {
      throw new AuthenticationError("Authentication required");
    }

    const hasRole = roles.some((role) => context.user!.roles.includes(role));
    if (!hasRole) {
      throw new AuthorizationError(
        `Required role: ${roles.join(" or ")}`,
      );
    }

    await next();
  };
}

export function optionalAuth(guard: Guard): AuthMiddleware {
  return authenticate(guard, true);
}

export function composeMiddleware(
  ...middlewares: AuthMiddleware[]
): AuthMiddleware {
  return async (
    req: AuthRequest,
    res: AuthResponse,
    next: NextFunction,
  ): Promise<void> => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;

      if (i === middlewares.length) {
        await next();
        return;
      }

      const middleware = middlewares[i];
      await middleware(req, res, () => dispatch(i + 1));
    };

    await dispatch(0);
  };
}

export function requireUser(): AuthMiddleware {
  return async (
    req: AuthRequest,
    _res: AuthResponse,
    next: NextFunction,
  ): Promise<void> => {
    const context = getAuthContext(req);
    if (!context?.user) {
      throw new AuthenticationError("Authentication required");
    }
    await next();
  };
}

export function createAuthContext(user: AuthUser, token?: string): AuthContext {
  return { user, token };
}
