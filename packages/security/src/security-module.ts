// @nexus/security - Module integration

import type { SecurityMiddleware, SecurityModuleOptions } from "./types.js";
import { cors } from "./cors.js";
import { csrf } from "./csrf.js";
import { rateLimit } from "./rate-limiter.js";
import { helmet } from "./helmet.js";
import { ipFilter } from "./ip-filter.js";

/**
 * SecurityModule - factory for creating security middleware stack
 */
export class SecurityModule {
  /**
   * Create a middleware stack from options
   */
  static create(options: SecurityModuleOptions = {}): SecurityMiddleware[] {
    const middlewares: SecurityMiddleware[] = [];

    // IP filter should be first (deny early)
    if (options.ipFilter) {
      middlewares.push(ipFilter(options.ipFilter));
    }

    // Rate limiting (deny early)
    if (options.rateLimit) {
      middlewares.push(rateLimit(options.rateLimit));
    }

    // Helmet (security headers)
    if (options.helmet !== undefined) {
      middlewares.push(helmet(options.helmet));
    } else {
      // Helmet defaults are always applied
      middlewares.push(helmet());
    }

    // CORS
    if (options.cors) {
      middlewares.push(cors(options.cors));
    }

    // CSRF
    if (options.csrf) {
      middlewares.push(csrf(options.csrf));
    }

    return middlewares;
  }

  /**
   * Create a single composed middleware from options
   */
  static middleware(options: SecurityModuleOptions = {}): SecurityMiddleware {
    const stack = SecurityModule.create(options);

    return (req, res, next) => {
      let index = 0;

      const run = (err?: Error): void => {
        if (err) {
          next(err);
          return;
        }
        if (index >= stack.length) {
          next();
          return;
        }
        const mw = stack[index++]!;
        try {
          const result = mw(req, res, run);
          if (result instanceof Promise) {
            result.catch(run);
          }
        } catch (e) {
          run(e instanceof Error ? e : new Error(String(e)));
        }
      };

      run();
    };
  }
}
