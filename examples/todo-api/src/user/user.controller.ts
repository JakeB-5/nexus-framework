/**
 * User/Auth Controller - Route Handlers
 *
 * In @nexus/auth, auth routes are auto-generated:
 *
 *   const auth = createAuth({ ... });
 *   app.use('/auth', auth.routes());
 *   // Auto-generates: POST /auth/register, POST /auth/login, GET /auth/me
 *
 * This controller manually defines the same endpoints.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuth } from "../middleware/auth.js";
import { sendJson } from "../middleware/error-handler.js";
import { userService } from "./user.service.js";
import { validateRegister, validateLogin } from "./user.validator.js";
import { parseBody } from "../app.js";

// ---------------------------------------------------------------------------
// POST /auth/register - Create a new user account
// ---------------------------------------------------------------------------

export async function register(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await parseBody(req);
  const input = validateRegister(body);
  const result = await userService.register(input);

  sendJson(res, 201, { data: result });
}

// ---------------------------------------------------------------------------
// POST /auth/login - Authenticate and receive a JWT token
// ---------------------------------------------------------------------------

export async function login(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await parseBody(req);
  const input = validateLogin(body);
  const result = await userService.login(input);

  sendJson(res, 200, { data: result });
}

// ---------------------------------------------------------------------------
// GET /auth/me - Get the current user's profile
// Requires a valid JWT token in the Authorization header.
// ---------------------------------------------------------------------------

export async function getMe(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = requireAuth(req);
  const profile = userService.getProfile(user.sub);

  sendJson(res, 200, { data: profile });
}
