// @nexus/router - Module integration
import { Router } from "./router.js";
import type { RouterOptions } from "./types.js";

export const ROUTER_TOKEN = Symbol.for("nexus:router");

export interface RouterModuleOptions extends RouterOptions {
  /** Auto-register router as middleware on HttpServer */
  autoRegister?: boolean;
}

export class RouterModule {
  static readonly token = ROUTER_TOKEN;

  static register(options?: RouterModuleOptions): {
    token: symbol;
    factory: () => Router;
    options: RouterModuleOptions;
  } {
    const opts: RouterModuleOptions = {
      prefix: "",
      caseSensitive: false,
      autoRegister: true,
      ...options,
    };

    return {
      token: ROUTER_TOKEN,
      factory: () => new Router(opts),
      options: opts,
    };
  }
}
