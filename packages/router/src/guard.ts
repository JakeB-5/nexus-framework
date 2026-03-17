// @nexus/router - Route guards
import type { Guard, GuardFunction, HandlerFunction, NexusRequestLike } from "./types.js";

export function createGuard(fn: GuardFunction): Guard {
  return {
    canActivate: fn,
  };
}

export function composeGuards(...guards: (Guard | GuardFunction)[]): GuardFunction {
  return async (req: NexusRequestLike): Promise<boolean> => {
    for (const guard of guards) {
      const fn = typeof guard === "function" ? guard : guard.canActivate.bind(guard);
      const allowed = await fn(req);
      if (!allowed) {
        return false;
      }
    }
    return true;
  };
}

export function guardMiddleware(...guards: (Guard | GuardFunction)[]): HandlerFunction {
  const composed = composeGuards(...guards);
  return async (req, res, next) => {
    const allowed = await composed(req);
    if (!allowed) {
      res.status(403).json({
        error: "Forbidden",
        message: "Access denied by guard",
        statusCode: 403,
      });
      return;
    }
    next();
  };
}
