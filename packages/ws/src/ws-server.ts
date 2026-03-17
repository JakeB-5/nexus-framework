// @nexus/ws - WebSocket server
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { BasicWsAdapter, isWebSocketUpgrade } from "./adapter.js";
import type { WsAdapter, WsSocket } from "./adapter.js";
import { RoomManager } from "./room.js";
import { WsClient } from "./ws-client.js";
import type {
  WsCloseHandler,
  WsConnectionHandler,
  WsErrorHandler,
  WsEventHandler,
  WsServerOptions,
} from "./types.js";

export class WebSocketServer {
  private readonly _options: Required<WsServerOptions>;
  private readonly _clients: Map<string, WsClient> = new Map();
  private readonly _rooms: RoomManager = new RoomManager();
  private readonly _adapter: WsAdapter;

  private readonly _eventHandlers: Map<string, WsEventHandler[]> = new Map();
  private _onConnection: WsConnectionHandler | undefined;
  private _onDisconnect: WsCloseHandler | undefined;
  private _onError: WsErrorHandler | undefined;

  private _heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private _attached = false;

  constructor(options?: WsServerOptions) {
    this._options = {
      path: options?.path ?? "/ws",
      maxConnections: options?.maxConnections ?? 10000,
      heartbeatInterval: options?.heartbeatInterval ?? 30000,
      heartbeatTimeout: options?.heartbeatTimeout ?? 10000,
      maxPayloadSize: options?.maxPayloadSize ?? 1024 * 1024,
      authHandler: options?.authHandler ?? (() => true),
    };
    this._adapter = new BasicWsAdapter();
  }

  attach(httpServer: HttpServer): void {
    if (this._attached) {
      return;
    }
    this._attached = true;

    httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this._handleUpgrade(req, socket, head);
    });

    this._startHeartbeat();
  }

  detach(): void {
    this._stopHeartbeat();
    this._attached = false;
  }

  onConnection(handler: WsConnectionHandler): this {
    this._onConnection = handler;
    return this;
  }

  onDisconnect(handler: WsCloseHandler): this {
    this._onDisconnect = handler;
    return this;
  }

  onError(handler: WsErrorHandler): this {
    this._onError = handler;
    return this;
  }

  on(event: string, handler: WsEventHandler): this {
    let handlers = this._eventHandlers.get(event);
    if (!handlers) {
      handlers = [];
      this._eventHandlers.set(event, handlers);
    }
    handlers.push(handler);
    return this;
  }

  off(event: string, handler: WsEventHandler): this {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }
    return this;
  }

  send(clientId: string, event: string, data: unknown): boolean {
    const client = this._clients.get(clientId);
    if (!client || !client.connected) {
      return false;
    }
    client.send(event, data);
    return true;
  }

  broadcast(event: string, data: unknown, excludeClientId?: string): number {
    let count = 0;
    for (const [id, client] of this._clients) {
      if (id !== excludeClientId && client.connected) {
        client.send(event, data);
        count++;
      }
    }
    return count;
  }

  broadcastToRoom(
    roomName: string,
    event: string,
    data: unknown,
    excludeClientId?: string,
  ): number {
    return this._rooms.broadcast(roomName, (clientId) => {
      this.send(clientId, event, data);
    }, excludeClientId);
  }

  getClient(clientId: string): WsClient | undefined {
    return this._clients.get(clientId);
  }

  getClients(): ReadonlyMap<string, WsClient> {
    return this._clients;
  }

  get rooms(): RoomManager {
    return this._rooms;
  }

  get clientCount(): number {
    return this._clients.size;
  }

  disconnectAll(code = 1000, reason = "Server shutdown"): void {
    for (const client of this._clients.values()) {
      client.disconnect(code, reason);
    }
    this._clients.clear();
    this._rooms.clear();
  }

  close(): void {
    this.disconnectAll(1001, "Server closing");
    this.detach();
  }

  private async _handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    // Check path
    const url = req.url ?? "/";
    const pathname = url.split("?")[0];
    if (pathname !== this._options.path) {
      socket.destroy();
      return;
    }

    // Check if it's a WebSocket upgrade
    if (!isWebSocketUpgrade(req)) {
      socket.destroy();
      return;
    }

    // Check max connections
    if (this._clients.size >= this._options.maxConnections) {
      socket.destroy();
      return;
    }

    // Auth check
    try {
      const authenticated = await this._options.authHandler(req);
      if (!authenticated) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }

    // Perform upgrade
    this._adapter.handleUpgrade(req, socket, head, (ws) => {
      this._handleConnection(ws, req);
    });
  }

  private _handleConnection(ws: WsSocket, req: IncomingMessage): void {
    const client = new WsClient({
      remoteAddress: req.socket.remoteAddress ?? "unknown",
      sendFn: (data) => ws.send(data),
      closeFn: (code, reason) => ws.close(code, reason),
    });

    // Register event handlers from server
    for (const [event, handlers] of this._eventHandlers) {
      for (const handler of handlers) {
        client.on(event, handler);
      }
    }

    this._clients.set(client.id, client);

    ws.on("message", (data: Buffer | string) => {
      const raw = typeof data === "string" ? data : data.toString("utf-8");
      client.handleMessage(raw);
    });

    ws.on("close", (code: number, reason: string) => {
      client.markDisconnected();
      this._rooms.leaveAll(client.id);
      this._clients.delete(client.id);
      if (this._onDisconnect) {
        void this._onDisconnect(code, reason, client.id);
      }
    });

    ws.on("error", (err: Error) => {
      if (this._onError) {
        void this._onError(err, client.id);
      }
    });

    if (this._onConnection) {
      void this._onConnection(client.id);
    }
  }

  private _startHeartbeat(): void {
    if (this._heartbeatTimer) {
      return;
    }

    this._heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this._options.heartbeatTimeout;

      for (const [id, client] of this._clients) {
        if (now - client.lastPong > this._options.heartbeatInterval + timeout) {
          // Client hasn't responded to heartbeat
          client.disconnect(1001, "Heartbeat timeout");
          this._rooms.leaveAll(id);
          this._clients.delete(id);
          continue;
        }
        // Send ping
        if (client.connected) {
          client.send("__ping__", null);
        }
      }
    }, this._options.heartbeatInterval);

    // Don't keep process alive just for heartbeat
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = undefined;
    }
  }
}
