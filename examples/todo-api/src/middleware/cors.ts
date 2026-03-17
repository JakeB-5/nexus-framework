/**
 * CORS Middleware
 *
 * In @nexus/http, CORS is handled by the built-in cors() middleware:
 *
 *   app.use(cors({
 *     origins: ['https://example.com'],
 *     methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *     credentials: true,
 *   }));
 *
 * This implementation handles both preflight (OPTIONS) requests
 * and normal requests, setting the appropriate CORS headers.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "../config/app.config.js";

// ---------------------------------------------------------------------------
// CORS header application
// ---------------------------------------------------------------------------

/**
 * Apply CORS headers to a response.
 * Returns true if this was a preflight request that should end immediately.
 */
export function handleCors(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const origin = req.headers.origin ?? "*";
  const corsConfig = config.cors;

  // Check if origin is allowed
  const isAllowed =
    corsConfig.origins.includes("*") || corsConfig.origins.includes(origin);

  if (isAllowed) {
    // Set the specific origin (not '*') when credentials are enabled
    res.setHeader(
      "Access-Control-Allow-Origin",
      corsConfig.credentials ? origin : corsConfig.origins.join(", "),
    );
  }

  // Always set these headers
  res.setHeader(
    "Access-Control-Allow-Methods",
    corsConfig.methods.join(", "),
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    corsConfig.headers.join(", "),
  );

  if (corsConfig.credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Max age for preflight cache (1 hour)
  res.setHeader("Access-Control-Max-Age", "3600");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true; // Signal that the request is complete
  }

  return false; // Continue to next middleware
}
