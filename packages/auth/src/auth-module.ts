// Auth module integration

import type { Guard } from "./guards.js";
import { JwtGuard } from "./guards.js";
import { RBAC } from "./rbac.js";
import { SessionManager } from "./session.js";
import { MemorySessionStore } from "./session-store.js";
import { TokenBlacklist, RefreshTokenStore } from "./token.js";
import type {
  RBACOptions,
  Role,
  SessionManagerOptions,
  JwtVerifyOptions,
  AuthUser,
} from "./types.js";

export interface AuthModuleOptions {
  jwt?: {
    secret: string;
    verifyOptions?: JwtVerifyOptions;
    userExtractor?: (payload: Record<string, unknown>) => AuthUser;
  };
  session?: SessionManagerOptions;
  rbac?: RBACOptions;
}

export class AuthModule {
  public readonly sessionManager: SessionManager;
  public readonly rbac: RBAC;
  public readonly tokenBlacklist: TokenBlacklist;
  public readonly refreshTokenStore: RefreshTokenStore;
  public readonly guard: Guard | undefined;

  constructor(options: AuthModuleOptions = {}) {
    // Set up session manager
    const store = new MemorySessionStore();
    this.sessionManager = new SessionManager(options.session ?? {}, store);

    // Set up RBAC
    const rbacOptions: RBACOptions = options.rbac ?? {
      roles: {
        user: { name: "user", permissions: [] },
        admin: {
          name: "admin",
          permissions: ["*"],
          inherits: ["user"],
        },
      },
    };
    this.rbac = new RBAC(rbacOptions);

    // Set up token management
    this.tokenBlacklist = new TokenBlacklist();
    this.refreshTokenStore = new RefreshTokenStore();

    // Set up JWT guard if configured
    if (options.jwt) {
      this.guard = new JwtGuard(
        options.jwt.secret,
        options.jwt.verifyOptions,
        options.jwt.userExtractor,
      );
    }
  }

  addRole(role: Role): void {
    this.rbac.addRole(role);
  }

  dispose(): void {
    this.tokenBlacklist.dispose();
    const store = this.sessionManager.getStore();
    if (store instanceof MemorySessionStore) {
      store.dispose();
    }
  }
}
