// Auth guards - JWT, Session, API Key, Composite

import { AuthenticationError } from "./errors.js";
import { verify as verifyJwt } from "./jwt.js";
import type { SessionManager } from "./session.js";
import type {
  AuthRequest,
  AuthUser,
  GuardResult,
  JwtVerifyOptions,
  SessionData,
} from "./types.js";

export interface Guard {
  authenticate(req: AuthRequest): Promise<GuardResult>;
}

export class JwtGuard implements Guard {
  constructor(
    private readonly secret: string,
    private readonly options: JwtVerifyOptions = {},
    private readonly userExtractor?: (payload: Record<string, unknown>) => AuthUser,
  ) {}

  async authenticate(req: AuthRequest): Promise<GuardResult> {
    const authHeader = req.headers["authorization"];
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!headerValue || !headerValue.startsWith("Bearer ")) {
      return { authenticated: false, error: "No Bearer token provided" };
    }

    const token = headerValue.slice(7);

    try {
      const payload = verifyJwt(token, this.secret, this.options);
      const user = this.userExtractor
        ? this.userExtractor(payload)
        : {
            id: (payload.sub as string) ?? "unknown",
            roles: (payload.roles as string[]) ?? [],
            ...(payload as Record<string, unknown>),
          };

      return { authenticated: true, user, token };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Token validation failed";
      return { authenticated: false, error: message };
    }
  }
}

export class SessionGuard<T extends SessionData = SessionData>
  implements Guard
{
  constructor(
    private readonly sessionManager: SessionManager<T>,
    private readonly userExtractor?: (data: T) => AuthUser,
  ) {}

  async authenticate(req: AuthRequest): Promise<GuardResult> {
    const cookieHeader = req.headers["cookie"];
    const cookieValue = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : cookieHeader;

    if (!cookieValue) {
      return { authenticated: false, error: "No session cookie" };
    }

    const sessionId = this.sessionManager.parseCookieHeader(cookieValue);
    if (!sessionId) {
      return { authenticated: false, error: "Session cookie not found" };
    }

    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      return { authenticated: false, error: "Invalid or expired session" };
    }

    const user = this.userExtractor
      ? this.userExtractor(session.data)
      : {
          id: (session.data["userId"] as string) ?? "unknown",
          roles: (session.data["roles"] as string[]) ?? [],
        };

    return { authenticated: true, user };
  }
}

export class ApiKeyGuard implements Guard {
  private readonly keys: Map<string, AuthUser>;
  private readonly headerName: string;

  constructor(
    keys: Record<string, AuthUser>,
    headerName = "x-api-key",
  ) {
    this.keys = new Map(Object.entries(keys));
    this.headerName = headerName.toLowerCase();
  }

  async authenticate(req: AuthRequest): Promise<GuardResult> {
    const apiKey = req.headers[this.headerName];
    const keyValue = Array.isArray(apiKey) ? apiKey[0] : apiKey;

    if (!keyValue) {
      return { authenticated: false, error: "No API key provided" };
    }

    const user = this.keys.get(keyValue);
    if (!user) {
      return { authenticated: false, error: "Invalid API key" };
    }

    return { authenticated: true, user, token: keyValue };
  }

  addKey(key: string, user: AuthUser): void {
    this.keys.set(key, user);
  }

  removeKey(key: string): boolean {
    return this.keys.delete(key);
  }
}

export class CompositeGuard implements Guard {
  private readonly guards: Guard[];

  constructor(guards: Guard[]) {
    if (guards.length === 0) {
      throw new AuthenticationError("CompositeGuard requires at least one guard");
    }
    this.guards = guards;
  }

  async authenticate(req: AuthRequest): Promise<GuardResult> {
    const errors: string[] = [];

    for (const guard of this.guards) {
      const result = await guard.authenticate(req);
      if (result.authenticated) {
        return result;
      }
      if (result.error) {
        errors.push(result.error);
      }
    }

    return {
      authenticated: false,
      error: `All guards failed: ${errors.join("; ")}`,
    };
  }
}
