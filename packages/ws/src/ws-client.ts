// @nexus/ws - WebSocket client connection wrapper
import { randomUUID } from "node:crypto";
import { encodeMessage, decodeMessage, createPong, isPing, isAck } from "./protocol.js";
import type { WsClientInfo, WsClientInterface, WsEventHandler } from "./types.js";

export class WsClient implements WsClientInterface {
  public readonly id: string;
  public readonly remoteAddress: string;
  public readonly connectedAt: number;
  public readonly metadata: Record<string, unknown>;

  private readonly _rooms: Set<string> = new Set();
  private readonly _eventHandlers: Map<string, WsEventHandler[]> = new Map();
  private readonly _ackCallbacks: Map<string, (data: unknown) => void> = new Map();
  private _connected = true;
  private _lastPong: number;
  private _sendFn: ((data: string) => void) | undefined;
  private _closeFn: ((code?: number, reason?: string) => void) | undefined;

  constructor(options: {
    id?: string;
    remoteAddress?: string;
    sendFn?: (data: string) => void;
    closeFn?: (code?: number, reason?: string) => void;
    metadata?: Record<string, unknown>;
  } = {}) {
    this.id = options.id ?? randomUUID();
    this.remoteAddress = options.remoteAddress ?? "unknown";
    this.connectedAt = Date.now();
    this.metadata = options.metadata ?? {};
    this._lastPong = Date.now();
    this._sendFn = options.sendFn;
    this._closeFn = options.closeFn;
  }

  get rooms(): ReadonlySet<string> {
    return this._rooms;
  }

  get connected(): boolean {
    return this._connected;
  }

  get lastPong(): number {
    return this._lastPong;
  }

  send(event: string, data: unknown): void {
    if (!this._connected || !this._sendFn) {
      return;
    }
    const message = encodeMessage(event, data);
    this._sendFn(message);
  }

  sendWithAck(event: string, data: unknown, timeout = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const message = encodeMessage(event, data, { id, ack: true });

      const timer = setTimeout(() => {
        this._ackCallbacks.delete(id);
        reject(new Error(`Ack timeout for message ${id}`));
      }, timeout);

      this._ackCallbacks.set(id, (ackData) => {
        clearTimeout(timer);
        this._ackCallbacks.delete(id);
        resolve(ackData);
      });

      if (this._sendFn) {
        this._sendFn(message);
      }
    });
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

  join(room: string): void {
    this._rooms.add(room);
  }

  leave(room: string): void {
    this._rooms.delete(room);
  }

  disconnect(code = 1000, reason = "Normal closure"): void {
    if (!this._connected) {
      return;
    }
    this._connected = false;
    if (this._closeFn) {
      this._closeFn(code, reason);
    }
    this._rooms.clear();
    this._ackCallbacks.clear();
  }

  handleMessage(raw: string | Buffer): void {
    try {
      const message = decodeMessage(raw);

      // Handle ping
      if (isPing(message)) {
        if (this._sendFn) {
          this._sendFn(createPong());
        }
        return;
      }

      // Handle pong
      if (message.event === "__pong__") {
        this._lastPong = Date.now();
        return;
      }

      // Handle ack response
      if (isAck(message) && message.id) {
        const callback = this._ackCallbacks.get(message.id);
        if (callback) {
          callback(message.data);
        }
        return;
      }

      // Dispatch to event handlers
      const handlers = this._eventHandlers.get(message.event);
      if (handlers) {
        for (const handler of handlers) {
          void handler(message.data, this.id);
        }
      }

      // Dispatch to wildcard handlers
      const wildcardHandlers = this._eventHandlers.get("*");
      if (wildcardHandlers) {
        for (const handler of wildcardHandlers) {
          void handler({ event: message.event, data: message.data }, this.id);
        }
      }
    } catch {
      // Invalid message, ignore or handle error
    }
  }

  markDisconnected(): void {
    this._connected = false;
    this._rooms.clear();
  }

  getInfo(): WsClientInfo {
    return {
      id: this.id,
      remoteAddress: this.remoteAddress,
      connectedAt: this.connectedAt,
      rooms: new Set(this._rooms),
      metadata: { ...this.metadata },
    };
  }

  setSendFn(fn: (data: string) => void): void {
    this._sendFn = fn;
  }

  setCloseFn(fn: (code?: number, reason?: string) => void): void {
    this._closeFn = fn;
  }
}
