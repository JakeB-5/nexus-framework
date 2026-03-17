// @nexus/ws - WebSocket adapter interface
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-5AB5DC29E75E";

export interface WsAdapter {
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (ws: WsSocket) => void,
  ): void;
}

export interface WsSocket {
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): void;
  ping(): void;
  readonly readyState: number;
}

export const WsReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * Basic HTTP upgrade WebSocket adapter.
 * Implements the WebSocket handshake and basic framing over raw TCP.
 */
export class BasicWsAdapter implements WsAdapter {
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    _head: Buffer,
    callback: (ws: WsSocket) => void,
  ): void {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = generateAcceptKey(key);

    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n");

    socket.write(headers);

    const ws = new BasicWsSocket(socket);
    callback(ws);
  }
}

export function generateAcceptKey(clientKey: string): string {
  return createHash("sha1")
    .update(clientKey + WS_MAGIC_STRING)
    .digest("base64");
}

export function isWebSocketUpgrade(req: IncomingMessage): boolean {
  const upgrade = req.headers.upgrade;
  return upgrade?.toLowerCase() === "websocket";
}

export function rejectUpgrade(res: ServerResponse, statusCode = 400, message = "Bad Request"): void {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(message);
}

// Basic WebSocket socket wrapping a raw Duplex stream
class BasicWsSocket implements WsSocket {
  private readonly _socket: Duplex;
  private readonly _handlers: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private _readyState: number = WsReadyState.OPEN;

  constructor(socket: Duplex) {
    this._socket = socket;

    socket.on("data", (data: Buffer) => {
      try {
        const frame = this._decodeFrame(data);
        if (frame) {
          if (frame.opcode === 0x08) {
            // Close frame
            this._readyState = WsReadyState.CLOSED;
            const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1000;
            const reason = frame.payload.length > 2 ? frame.payload.subarray(2).toString("utf-8") : "";
            this._emit("close", code, reason);
            socket.end();
          } else if (frame.opcode === 0x09) {
            // Ping - respond with pong
            this._sendFrame(0x0a, frame.payload);
          } else if (frame.opcode === 0x0a) {
            // Pong
            this._emit("pong");
          } else if (frame.opcode === 0x01 || frame.opcode === 0x02) {
            // Text or binary
            const message = frame.opcode === 0x01 ? frame.payload.toString("utf-8") : frame.payload;
            this._emit("message", message);
          }
        }
      } catch (err) {
        this._emit("error", err instanceof Error ? err : new Error(String(err)));
      }
    });

    socket.on("close", () => {
      if (this._readyState !== WsReadyState.CLOSED) {
        this._readyState = WsReadyState.CLOSED;
        this._emit("close", 1006, "Abnormal closure");
      }
    });

    socket.on("error", (err: Error) => {
      this._emit("error", err);
    });
  }

  get readyState(): number {
    return this._readyState;
  }

  send(data: string | Buffer): void {
    if (this._readyState !== WsReadyState.OPEN) {
      return;
    }
    const payload = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const opcode = typeof data === "string" ? 0x01 : 0x02;
    this._sendFrame(opcode, payload);
  }

  close(code = 1000, reason = ""): void {
    if (this._readyState !== WsReadyState.OPEN) {
      return;
    }
    this._readyState = WsReadyState.CLOSING;

    const reasonBuf = Buffer.from(reason, "utf-8");
    const payload = Buffer.allocUnsafe(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);

    this._sendFrame(0x08, payload);
    this._readyState = WsReadyState.CLOSED;
    this._socket.end();
  }

  ping(): void {
    if (this._readyState === WsReadyState.OPEN) {
      this._sendFrame(0x09, Buffer.alloc(0));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): void {
    let handlers = this._handlers.get(event);
    if (!handlers) {
      handlers = [];
      this._handlers.set(event, handlers);
    }
    handlers.push(handler);
  }

  private _emit(event: string, ...args: unknown[]): void {
    const handlers = this._handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  private _sendFrame(opcode: number, payload: Buffer): void {
    const len = payload.length;
    let headerLen = 2;

    if (len > 125 && len <= 65535) {
      headerLen = 4;
    } else if (len > 65535) {
      headerLen = 10;
    }

    const frame = Buffer.allocUnsafe(headerLen + len);
    frame[0] = 0x80 | opcode; // FIN bit + opcode

    if (len <= 125) {
      frame[1] = len;
    } else if (len <= 65535) {
      frame[1] = 126;
      frame.writeUInt16BE(len, 2);
    } else {
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(len), 2);
    }

    payload.copy(frame, headerLen);

    try {
      this._socket.write(frame);
    } catch {
      // Socket may be destroyed
    }
  }

  private _decodeFrame(data: Buffer): { opcode: number; payload: Buffer } | undefined {
    if (data.length < 2) {
      return undefined;
    }

    const opcode = data[0]! & 0x0f;
    const masked = (data[1]! & 0x80) !== 0;
    let payloadLen = data[1]! & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (data.length < 4) return undefined;
      payloadLen = data.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      if (data.length < 10) return undefined;
      payloadLen = Number(data.readBigUInt64BE(2));
      offset = 10;
    }

    if (masked) {
      if (data.length < offset + 4 + payloadLen) return undefined;
      const mask = data.subarray(offset, offset + 4);
      offset += 4;

      const payload = Buffer.allocUnsafe(payloadLen);
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = data[offset + i]! ^ mask[i % 4]!;
      }
      return { opcode, payload };
    }

    if (data.length < offset + payloadLen) return undefined;
    return { opcode, payload: data.subarray(offset, offset + payloadLen) };
  }
}
