// @nexus/security - Security middleware: CORS, CSRF, rate limiting, helmet

export { cors, isOriginAllowed } from "./cors.js";
export { csrf, generateCsrfToken } from "./csrf.js";
export { rateLimit, TokenBucketStore, SlidingWindowStore } from "./rate-limiter.js";
export { helmet, buildCspHeader } from "./helmet.js";
export {
  encodeHtml,
  stripTags,
  escapeSqlChars,
  sanitizePath,
  hasPathTraversal,
  sanitize,
  sanitizeObject,
} from "./sanitizer.js";
export {
  ipFilter,
  parseCidr,
  matchesCidr,
  normalizeIp,
  isIpInList,
} from "./ip-filter.js";
export { SecurityModule } from "./security-module.js";
export {
  SecurityError,
  CorsError,
  CsrfError,
  RateLimitError,
  IpDeniedError,
} from "./errors.js";
export type {
  SecurityMiddleware,
  CorsOptions,
  CsrfOptions,
  RateLimitAlgorithm,
  RateLimitOptions,
  RateLimitInfo,
  HelmetOptions,
  CspOptions,
  FrameguardOptions,
  HstsOptions,
  ReferrerPolicy,
  SanitizeOptions,
  IpFilterMode,
  IpFilterOptions,
  SecurityModuleOptions,
} from "./types.js";
