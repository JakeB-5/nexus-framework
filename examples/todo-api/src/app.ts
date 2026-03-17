/**
 * Application Setup & Router
 *
 * In a Nexus application, the app is built using the application factory:
 *
 *   const app = createApp({
 *     modules: [AuthModule, TodoModule],
 *     middleware: [cors(), requestLogger(), errorHandler()],
 *     config: appConfig,
 *   });
 *
 * This file sets up the HTTP server with manual routing, demonstrating
 * the same middleware pipeline and routing patterns that @nexus/http
 * and @nexus/router provide automatically.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleCors } from "./middleware/cors.js";
import { handleError, sendJson, NotFoundException, BadRequestException } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/logger.js";

// Import controllers
import {
  listTodos,
  getTodo,
  getTodoStats,
  createTodoHandler,
  updateTodo,
  deleteTodo,
} from "./todo/todo.controller.js";
import {
  register,
  login,
  getMe,
} from "./user/user.controller.js";

// ---------------------------------------------------------------------------
// Request body parser
// Reads and parses JSON request bodies. In @nexus/http, this is
// built into the framework and configured via bodyParser() middleware.
// ---------------------------------------------------------------------------

export function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new BadRequestException("Request body too large (max 1MB)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new BadRequestException("Invalid JSON in request body"));
      }
    });

    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// URL parser helper
// ---------------------------------------------------------------------------

export function parseUrlParams(req: IncomingMessage): URL {
  // Construct a full URL; the host doesn't matter for path parsing
  return new URL(req.url ?? "/", "http://localhost");
}

// ---------------------------------------------------------------------------
// Route matching
// Simple pattern-based router that matches paths and extracts parameters.
// In @nexus/router, this is handled by a trie-based router with support
// for path params, wildcards, and middleware chains.
// ---------------------------------------------------------------------------

interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
}

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ...args: string[]
) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

// Route registry
const routes: Route[] = [];

/** Register a route with method, path pattern, and handler */
function route(
  method: string,
  path: string,
  handler: RouteHandler,
): void {
  // Convert path like "/todos/:id" into a regex with named capture groups
  const paramNames: string[] = [];
  const regexStr = path.replace(/:(\w+)/g, (_match, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });

  routes.push({
    method: method.toUpperCase(),
    pattern: new RegExp(`^${regexStr}$`),
    paramNames,
    handler,
  });
}

/** Find a matching route for the given method and path */
function matchRoute(method: string, pathname: string): RouteMatch | null {
  for (const r of routes) {
    if (r.method !== method.toUpperCase()) continue;
    const match = pathname.match(r.pattern);
    if (match) {
      const params: Record<string, string> = {};
      r.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler: r.handler, params };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Register all routes
// ---------------------------------------------------------------------------

// Health check endpoint (no auth required)
route("GET", "/health", async (_req, res) => {
  sendJson(res, 200, {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Auth routes (no auth required for register/login)
route("POST", "/auth/register", register);
route("POST", "/auth/login", login);
route("GET", "/auth/me", getMe);

// Todo routes (all require authentication)
route("GET", "/todos/stats", getTodoStats);
route("GET", "/todos", listTodos);
route("GET", "/todos/:id", getTodo);
route("POST", "/todos", createTodoHandler);
route("PUT", "/todos/:id", updateTodo);
route("DELETE", "/todos/:id", deleteTodo);

// ---------------------------------------------------------------------------
// Main request handler
// This is the top-level handler that processes every incoming request
// through the middleware pipeline and routes to the appropriate controller.
//
// In @nexus/http, this pipeline is built automatically:
//   cors → logger → bodyParser → router → errorHandler
// ---------------------------------------------------------------------------

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    // 1. CORS middleware - handle preflight and set headers
    const isPreflightDone = handleCors(req, res);
    if (isPreflightDone) return;

    // 2. Request logging - logs method, url, status, and duration
    requestLogger(req, res);

    // 3. Route matching
    const { pathname } = parseUrlParams(req);
    const method = req.method ?? "GET";

    const matched = matchRoute(method, pathname);
    if (!matched) {
      throw new NotFoundException(`Cannot ${method} ${pathname}`);
    }

    // 4. Execute the route handler with extracted params
    const paramValues = Object.values(matched.params);
    await matched.handler(req, res, ...paramValues);
  } catch (error) {
    // 5. Global error handler - catches all errors from the pipeline
    handleError(error, res);
  }
}
