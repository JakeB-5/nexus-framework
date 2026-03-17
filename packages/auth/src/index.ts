// @nexus/auth - Authentication and authorization with JWT, sessions, RBAC

export { sign, verify, decode, refresh } from "./jwt.js";
export {
  SessionManager,
} from "./session.js";
export {
  SessionStore,
  MemorySessionStore,
} from "./session-store.js";
export { RBAC } from "./rbac.js";
export {
  hash,
  verify as verifyPassword,
  generateSalt,
  parseHash,
  validatePasswordStrength,
} from "./password.js";
export {
  authenticate,
  authorize,
  requireRole,
  optionalAuth,
  composeMiddleware,
  requireUser,
  getAuthContext,
  setAuthContext,
  createAuthContext,
} from "./middleware.js";
export {
  JwtGuard,
  SessionGuard,
  ApiKeyGuard,
  CompositeGuard,
} from "./guards.js";
export type { Guard } from "./guards.js";
export {
  generateToken,
  generateApiKey,
  generateRefreshToken,
  TokenBlacklist,
  RefreshTokenStore,
} from "./token.js";
export { AuthModule } from "./auth-module.js";
export type { AuthModuleOptions } from "./auth-module.js";
export {
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  InvalidTokenError,
  TokenNotBeforeError,
} from "./errors.js";
export type {
  JwtHeader,
  JwtAlgorithm,
  JwtPayload,
  JwtSignOptions,
  JwtVerifyOptions,
  DecodedJwt,
  SessionData,
  Session,
  SessionManagerOptions,
  CookieOptions,
  Permission,
  Role,
  RBACOptions,
  AuthUser,
  AuthContext,
  AuthenticateOptions,
  PasswordHashOptions,
  PasswordHashResult,
  TokenOptions,
  ApiKeyOptions,
  GuardResult,
  AuthRequest,
  AuthResponse,
  NextFunction,
  AuthMiddleware,
} from "./types.js";
