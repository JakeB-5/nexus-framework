// @nexus/security - CORS middleware

import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";
import type { CorsOptions, SecurityMiddleware } from "./types.js";

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];
const DEFAULT_HEADERS = ["Content-Type", "Authorization", "Accept"];

/**
 * Check if the origin is allowed
 */
function isOriginAllowed(origin: string, allowed: CorsOptions["origin"]): boolean {
  if (!allowed || allowed === "*") return true;
  if (typeof allowed === "string") return origin === allowed;
  if (Array.isArray(allowed)) return allowed.includes(origin);
  if (typeof allowed === "function") return allowed(origin);
  return false;
}

/**
 * Create CORS middleware
 */
export function cors(options: CorsOptions = {}): SecurityMiddleware {
  const {
    origin = "*",
    methods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_HEADERS,
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
    preflight = true,
  } = options;

  return (req: NexusRequestInterface, res: NexusResponseInterface, next: NextFunction): void => {
    const requestOrigin = req.get("origin") ?? "";

    // Determine the allowed origin value for the response
    let allowedOriginValue: string;
    if (origin === "*" && !credentials) {
      allowedOriginValue = "*";
    } else if (isOriginAllowed(requestOrigin, origin)) {
      allowedOriginValue = requestOrigin;
    } else {
      // Origin not allowed - skip CORS headers
      if (req.method === "OPTIONS" && preflight) {
        res.status(204).end();
        return;
      }
      next();
      return;
    }

    // Set CORS headers
    res.header("Access-Control-Allow-Origin", allowedOriginValue);

    if (credentials) {
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (exposedHeaders.length > 0) {
      res.header("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    }

    // Add Vary header for origin-specific responses
    if (allowedOriginValue !== "*") {
      res.header("Vary", "Origin");
    }

    // Handle preflight
    if (req.method === "OPTIONS" && preflight) {
      res.header("Access-Control-Allow-Methods", methods.join(", "));
      res.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));

      if (maxAge > 0) {
        res.header("Access-Control-Max-Age", String(maxAge));
      }

      res.status(204).end();
      return;
    }

    next();
  };
}

export { isOriginAllowed };
