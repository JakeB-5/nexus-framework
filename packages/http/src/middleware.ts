// @nexus/http - Middleware system
import type {
  ErrorMiddlewareFunction,
  MiddlewareEntry,
  MiddlewareFunction,
  NextFunction,
  NexusRequestInterface,
  NexusResponseInterface,
} from "./types.js";

function isErrorMiddleware(fn: MiddlewareEntry): fn is ErrorMiddlewareFunction {
  return fn.length === 4;
}

export class MiddlewarePipeline {
  private readonly _middlewares: MiddlewareEntry[] = [];

  use(...middlewares: MiddlewareEntry[]): this {
    this._middlewares.push(...middlewares);
    return this;
  }

  async execute(
    req: NexusRequestInterface,
    res: NexusResponseInterface,
  ): Promise<void> {
    let idx = 0;
    let currentError: Error | undefined;

    const next: NextFunction = (error?: Error) => {
      if (error) {
        currentError = error;
      }
    };

    while (idx < this._middlewares.length) {
      const middleware = this._middlewares[idx]!;
      idx++;

      if (res.headersSent) {
        return;
      }

      try {
        if (currentError) {
          // Skip non-error middleware when we have an error
          if (isErrorMiddleware(middleware)) {
            const prevError = currentError;
            currentError = undefined;
            await middleware(prevError, req, res, next);
          }
          // Non-error middleware is skipped when in error state
        } else {
          if (!isErrorMiddleware(middleware)) {
            await middleware(req, res, next);
          }
          // Error middleware is skipped when there's no error
        }
      } catch (err) {
        currentError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // If there's an unhandled error after pipeline, throw it
    if (currentError && !res.headersSent) {
      throw currentError;
    }
  }

  get length(): number {
    return this._middlewares.length;
  }
}

export function compose(...middlewares: MiddlewareFunction[]): MiddlewareFunction {
  return async (req, res, next) => {
    let idx = 0;

    const dispatch = async (): Promise<void> => {
      if (idx >= middlewares.length) {
        next();
        return;
      }

      const current = middlewares[idx]!;
      idx++;

      let nextCalled = false;
      const innerNext: NextFunction = (error?: Error) => {
        nextCalled = true;
        if (error) {
          next(error);
          return;
        }
      };

      await current(req, res, innerNext);

      if (nextCalled && !res.headersSent) {
        await dispatch();
      }
    };

    await dispatch();
  };
}
