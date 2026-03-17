// @nexus/router - Router class
import { Route, joinPaths } from "./route.js";
import type { RouteGroupApi } from "./route-group.js";
import { RouteTrie } from "./trie.js";
import type {
  HandlerFunction,
  HttpMethod,
  NexusRequestLike,
  NexusResponseLike,
  NextFunction,
  RouteDefinition,
  RouteMatch,
  RouterOptions,
} from "./types.js";

export class Router {
  private readonly _trie: RouteTrie;
  private readonly _prefix: string;
  private readonly _routes: RouteDefinition[] = [];
  private readonly _middlewares: HandlerFunction[] = [];
  private readonly _namedRoutes: Map<string, RouteDefinition> = new Map();

  constructor(options?: RouterOptions) {
    this._prefix = options?.prefix ?? "";
    this._trie = new RouteTrie(options?.caseSensitive ?? false);
  }

  get(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("GET", path, handlers);
  }

  post(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("POST", path, handlers);
  }

  put(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("PUT", path, handlers);
  }

  patch(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("PATCH", path, handlers);
  }

  delete(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("DELETE", path, handlers);
  }

  head(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("HEAD", path, handlers);
  }

  options(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("OPTIONS", path, handlers);
  }

  all(path: string, ...handlers: HandlerFunction[]): this {
    return this._addRoute("ALL", path, handlers);
  }

  use(prefixOrMiddleware: string | HandlerFunction, ...args: (HandlerFunction | Router)[]): this {
    if (typeof prefixOrMiddleware === "function") {
      this._middlewares.push(prefixOrMiddleware);
      return this;
    }

    const prefix = prefixOrMiddleware;
    for (const arg of args) {
      if (arg instanceof Router) {
        this._mountRouter(prefix, arg);
      } else {
        this._middlewares.push((req, res, next) => {
          if (req.path.startsWith(prefix)) {
            return arg(req, res, next);
          }
          next();
        });
      }
    }
    return this;
  }

  group(prefix: string, callback: (group: RouteGroupApi) => void): this {
    const groupApi: RouteGroupApi = {
      get: (path, ...handlers) => this._addRoute("GET", joinPaths(prefix, path), handlers),
      post: (path, ...handlers) => this._addRoute("POST", joinPaths(prefix, path), handlers),
      put: (path, ...handlers) => this._addRoute("PUT", joinPaths(prefix, path), handlers),
      patch: (path, ...handlers) => this._addRoute("PATCH", joinPaths(prefix, path), handlers),
      delete: (path, ...handlers) => this._addRoute("DELETE", joinPaths(prefix, path), handlers),
      group: (nestedPrefix, nestedCallback) => {
        this.group(joinPaths(prefix, nestedPrefix), nestedCallback);
      },
    };

    callback(groupApi);
    return this;
  }

  resolve(method: string, path: string): RouteMatch | undefined {
    const fullPath = this._prefix ? path.replace(new RegExp(`^${this._prefix}`), "") || "/" : path;
    return this._trie.match(method.toUpperCase() as HttpMethod, fullPath);
  }

  getAllowedMethods(path: string): HttpMethod[] {
    return this._trie.getAllowedMethods(path);
  }

  getRouteByName(name: string): RouteDefinition | undefined {
    return this._namedRoutes.get(name);
  }

  get routes(): readonly RouteDefinition[] {
    return this._routes;
  }

  handler(): HandlerFunction {
    return async (req: NexusRequestLike, res: NexusResponseLike, next: NextFunction) => {
      const match = this.resolve(req.method, req.path);

      if (!match) {
        const allowed = this.getAllowedMethods(req.path);
        if (allowed.length > 0) {
          res.header("Allow", allowed.join(", "));
          res.status(405).json({
            error: "MethodNotAllowed",
            message: `Method ${req.method} not allowed`,
            statusCode: 405,
          });
          return;
        }
        next();
        return;
      }

      // Set params on request
      req.params = match.params;

      // Execute middleware chain then route handlers
      const allHandlers = [...this._middlewares, ...match.handlers];
      let idx = 0;

      const dispatch = async (): Promise<void> => {
        if (idx >= allHandlers.length || res.headersSent) {
          return;
        }
        const currentHandler = allHandlers[idx]!;
        idx++;
        await currentHandler(req, res, async (err?: Error) => {
          if (err) {
            next(err);
            return;
          }
          await dispatch();
        });
      };

      await dispatch();
    };
  }

  private _addRoute(
    method: HttpMethod,
    path: string,
    handlers: HandlerFunction[],
    options?: { name?: string; metadata?: Record<string, unknown> },
  ): this {
    const fullPath = this._prefix ? joinPaths(this._prefix, path) : path;
    const route = new Route(method, fullPath, handlers, options);
    this._trie.insert(route);
    this._routes.push(route);

    if (options?.name) {
      this._namedRoutes.set(options.name, route);
    }

    return this;
  }

  private _mountRouter(prefix: string, router: Router): void {
    for (const route of router.routes) {
      const mountedPath = joinPaths(prefix, route.path);
      this._addRoute(route.method, mountedPath, route.handlers, {
        name: route.name,
        metadata: route.metadata,
      });
    }
  }
}
