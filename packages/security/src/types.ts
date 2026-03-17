// @nexus/security - Type definitions

import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";

export type SecurityMiddleware = (
  req: NexusRequestInterface,
  res: NexusResponseInterface,
  next: NextFunction,
) => void | Promise<void>;

// CORS
export interface CorsOptions {
  /** Allowed origins - string, array, or function */
  origin?: string | string[] | ((origin: string) => boolean);
  /** Allowed HTTP methods */
  methods?: string[];
  /** Allowed request headers */
  allowedHeaders?: string[];
  /** Headers exposed to the browser */
  exposedHeaders?: string[];
  /** Allow credentials (cookies, authorization) */
  credentials?: boolean;
  /** Preflight cache duration in seconds */
  maxAge?: number;
  /** Handle preflight OPTIONS automatically */
  preflight?: boolean;
}

// CSRF
export interface CsrfOptions {
  /** Cookie name for the CSRF token */
  cookieName?: string;
  /** Header name to check for the token */
  headerName?: string;
  /** Form field name to check */
  fieldName?: string;
  /** Token byte length */
  tokenLength?: number;
  /** Methods that require CSRF validation */
  protectedMethods?: string[];
  /** Paths to exclude from CSRF protection */
  excludePaths?: string[];
  /** Cookie options */
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    path?: string;
  };
}

// Rate Limiter
export type RateLimitAlgorithm = "token-bucket" | "sliding-window";

export interface RateLimitOptions {
  /** Maximum requests in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Algorithm to use */
  algorithm?: RateLimitAlgorithm;
  /** Key generator - defaults to IP */
  keyGenerator?: (req: NexusRequestInterface) => string;
  /** Skip function - return true to bypass rate limiting */
  skip?: (req: NexusRequestInterface) => boolean;
  /** Custom response handler */
  handler?: (req: NexusRequestInterface, res: NexusResponseInterface) => void;
  /** Include rate limit headers */
  headers?: boolean;
  /** Message when rate limited */
  message?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
}

// Helmet (Security Headers)
export interface HelmetOptions {
  /** Content Security Policy */
  contentSecurityPolicy?: CspOptions | false;
  /** X-Frame-Options */
  frameguard?: FrameguardOptions | false;
  /** Strict-Transport-Security */
  hsts?: HstsOptions | false;
  /** X-Content-Type-Options: nosniff */
  noSniff?: boolean;
  /** X-XSS-Protection */
  xssFilter?: boolean;
  /** Referrer-Policy */
  referrerPolicy?: ReferrerPolicy | false;
  /** X-DNS-Prefetch-Control */
  dnsPrefetchControl?: boolean;
  /** X-Permitted-Cross-Domain-Policies */
  crossDomainPolicy?: "none" | "master-only" | "by-content-type" | "all" | false;
  /** X-Download-Options */
  ieNoOpen?: boolean;
}

export interface CspOptions {
  directives: Record<string, string | string[]>;
  reportOnly?: boolean;
}

export interface FrameguardOptions {
  action: "deny" | "sameorigin";
}

export interface HstsOptions {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

// Sanitizer
export interface SanitizeOptions {
  /** Allow certain HTML tags */
  allowedTags?: string[];
  /** Maximum string length */
  maxLength?: number;
}

// IP Filter
export type IpFilterMode = "whitelist" | "blacklist";

export interface IpFilterOptions {
  /** Filter mode */
  mode: IpFilterMode;
  /** List of IPs or CIDRs */
  ips: string[];
  /** Custom denied handler */
  handler?: (req: NexusRequestInterface, res: NexusResponseInterface) => void;
}

// Security Module
export interface SecurityModuleOptions {
  cors?: CorsOptions;
  csrf?: CsrfOptions;
  rateLimit?: RateLimitOptions;
  helmet?: HelmetOptions;
  ipFilter?: IpFilterOptions;
}
