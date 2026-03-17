// Auth types for JWT, sessions, RBAC, and middleware

export interface JwtHeader {
  alg: JwtAlgorithm;
  typ: "JWT";
}

export type JwtAlgorithm = "HS256" | "HS384" | "HS512";

export interface JwtPayload {
  [key: string]: unknown;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

export interface JwtSignOptions {
  algorithm?: JwtAlgorithm;
  expiresIn?: number;
  notBefore?: number;
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  jwtId?: string;
}

export interface JwtVerifyOptions {
  algorithms?: JwtAlgorithm[];
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  clockTolerance?: number;
  maxAge?: number;
  ignoreExpiration?: boolean;
  ignoreNotBefore?: boolean;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  signature: string;
}

export interface SessionData {
  [key: string]: unknown;
}

export interface Session<T extends SessionData = SessionData> {
  id: string;
  data: T;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface SessionManagerOptions {
  ttl?: number;
  slidingExpiration?: boolean;
  cookieName?: string;
  cookieOptions?: CookieOptions;
  generateId?: () => string;
}

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  domain?: string;
  maxAge?: number;
}

export interface Permission {
  resource: string;
  action: string;
}

export interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface RBACOptions {
  roles: Record<string, Role>;
  defaultRole?: string;
}

export interface AuthUser {
  id: string;
  roles: string[];
  permissions?: string[];
  [key: string]: unknown;
}

export interface AuthContext {
  user?: AuthUser;
  token?: string;
  sessionId?: string;
}

export interface AuthenticateOptions {
  optional?: boolean;
  strategies?: string[];
}

export interface PasswordHashOptions {
  saltLength?: number;
  keyLength?: number;
  cost?: number;
  blockSize?: number;
  parallelization?: number;
}

export interface PasswordHashResult {
  hash: string;
  salt: string;
  params: {
    N: number;
    r: number;
    p: number;
    keyLength: number;
  };
}

export interface TokenOptions {
  prefix?: string;
  length?: number;
  expiresIn?: number;
}

export interface ApiKeyOptions {
  prefix?: string;
  length?: number;
}

export interface GuardResult {
  authenticated: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}

export interface AuthResponse {
  setHeader(name: string, value: string): void;
  setCookie?(name: string, value: string, options?: CookieOptions): void;
}

export type NextFunction = () => void | Promise<void>;

export type AuthMiddleware = (
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction,
) => void | Promise<void>;
