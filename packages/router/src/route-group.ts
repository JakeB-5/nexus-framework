// @nexus/router - Route grouping
import type { HandlerFunction } from "./types.js";

export interface RouteGroupOptions {
  prefix: string;
  middlewares?: HandlerFunction[];
}

export class RouteGroup {
  public readonly prefix: string;
  public readonly middlewares: HandlerFunction[];
  private readonly _children: RouteGroup[] = [];
  private readonly _configCallback: ((group: RouteGroupApi) => void) | undefined;

  constructor(options: RouteGroupOptions, configCallback?: (group: RouteGroupApi) => void) {
    this.prefix = options.prefix;
    this.middlewares = options.middlewares ?? [];
    this._configCallback = configCallback;
  }

  configure(api: RouteGroupApi): void {
    if (this._configCallback) {
      this._configCallback(api);
    }
  }

  addChild(group: RouteGroup): void {
    this._children.push(group);
  }

  get children(): readonly RouteGroup[] {
    return this._children;
  }
}

export interface RouteGroupApi {
  get(path: string, ...handlers: HandlerFunction[]): void;
  post(path: string, ...handlers: HandlerFunction[]): void;
  put(path: string, ...handlers: HandlerFunction[]): void;
  patch(path: string, ...handlers: HandlerFunction[]): void;
  delete(path: string, ...handlers: HandlerFunction[]): void;
  group(prefix: string, callback: (group: RouteGroupApi) => void): void;
}
