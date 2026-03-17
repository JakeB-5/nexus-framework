// @nexus/ws - Module integration
import { WebSocketServer } from "./ws-server.js";
import type { WsServerOptions } from "./types.js";

export const WS_SERVER_TOKEN = Symbol.for("nexus:ws:server");

export interface WsModuleOptions extends WsServerOptions {
  autoAttach?: boolean;
}

export class WsModule {
  static readonly token = WS_SERVER_TOKEN;

  static register(options?: WsModuleOptions): {
    token: symbol;
    factory: () => WebSocketServer;
    options: WsModuleOptions;
  } {
    const opts: WsModuleOptions = {
      path: "/ws",
      maxConnections: 10000,
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      autoAttach: true,
      ...options,
    };

    return {
      token: WS_SERVER_TOKEN,
      factory: () => new WebSocketServer(opts),
      options: opts,
    };
  }
}
