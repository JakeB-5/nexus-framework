// @nexus/security - Helmet security headers middleware

import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";
import type { CspOptions, HelmetOptions, SecurityMiddleware } from "./types.js";

/**
 * Build CSP header value from directives
 */
export function buildCspHeader(options: CspOptions): string {
  const parts: string[] = [];

  for (const [directive, value] of Object.entries(options.directives)) {
    const normalizedDirective = directive.replace(/([A-Z])/g, "-$1").toLowerCase();
    const values = Array.isArray(value) ? value.join(" ") : value;
    parts.push(`${normalizedDirective} ${values}`);
  }

  return parts.join("; ");
}

/**
 * Create helmet middleware that sets security-related HTTP headers
 */
export function helmet(options: HelmetOptions = {}): SecurityMiddleware {
  const {
    contentSecurityPolicy,
    frameguard = { action: "sameorigin" },
    hsts = { maxAge: 15552000, includeSubDomains: true },
    noSniff = true,
    xssFilter = true,
    referrerPolicy = "strict-origin-when-cross-origin",
    dnsPrefetchControl = true,
    crossDomainPolicy = "none",
    ieNoOpen = true,
  } = options;

  return (_req: NexusRequestInterface, res: NexusResponseInterface, next: NextFunction): void => {
    // Content Security Policy
    if (contentSecurityPolicy !== false && contentSecurityPolicy) {
      const headerName = contentSecurityPolicy.reportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";
      res.header(headerName, buildCspHeader(contentSecurityPolicy));
    }

    // X-Frame-Options
    if (frameguard !== false) {
      res.header("X-Frame-Options", frameguard.action.toUpperCase());
    }

    // Strict-Transport-Security
    if (hsts !== false) {
      let value = `max-age=${hsts.maxAge}`;
      if (hsts.includeSubDomains) {
        value += "; includeSubDomains";
      }
      if (hsts.preload) {
        value += "; preload";
      }
      res.header("Strict-Transport-Security", value);
    }

    // X-Content-Type-Options
    if (noSniff) {
      res.header("X-Content-Type-Options", "nosniff");
    }

    // X-XSS-Protection
    if (xssFilter) {
      res.header("X-XSS-Protection", "0");
    }

    // Referrer-Policy
    if (referrerPolicy !== false) {
      res.header("Referrer-Policy", referrerPolicy);
    }

    // X-DNS-Prefetch-Control
    if (dnsPrefetchControl !== undefined) {
      res.header("X-DNS-Prefetch-Control", dnsPrefetchControl ? "off" : "on");
    }

    // X-Permitted-Cross-Domain-Policies
    if (crossDomainPolicy !== false) {
      res.header("X-Permitted-Cross-Domain-Policies", crossDomainPolicy);
    }

    // X-Download-Options (IE)
    if (ieNoOpen) {
      res.header("X-Download-Options", "noopen");
    }

    next();
  };
}
