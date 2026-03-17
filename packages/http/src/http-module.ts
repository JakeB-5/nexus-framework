// @nexus/http - Module integration
import { HttpServer } from "./server.js";
import type { HttpServerOptions } from "./types.js";

export const HTTP_SERVER_TOKEN = Symbol.for("nexus:http:server");
export const HTTP_OPTIONS_TOKEN = Symbol.for("nexus:http:options");

export interface HttpModuleOptions extends HttpServerOptions {
  /** Auto-start server on module init */
  autoStart?: boolean;
}

export class HttpModule {
  static readonly token = HTTP_SERVER_TOKEN;

  static register(options?: HttpModuleOptions): {
    token: symbol;
    factory: () => HttpServer;
    options: HttpModuleOptions;
  } {
    const opts: HttpModuleOptions = {
      port: 3000,
      host: "0.0.0.0",
      autoStart: false,
      ...options,
    };

    return {
      token: HTTP_SERVER_TOKEN,
      factory: () => new HttpServer(opts),
      options: opts,
    };
  }
}
