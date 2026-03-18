// @nexus/ws - Error classes

import { NexusError } from "@nexus/core";

export class WebSocketError extends NexusError {
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message, { code: code ?? "WS_ERROR", context });
    this.name = "WebSocketError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConnectionError extends WebSocketError {
  constructor(message = "Connection failed", context?: Record<string, unknown>) {
    super(message, "CONNECTION_ERROR", context);
    this.name = "ConnectionError";
  }
}

export class ProtocolError extends WebSocketError {
  constructor(message = "Protocol error", context?: Record<string, unknown>) {
    super(message, "PROTOCOL_ERROR", context);
    this.name = "ProtocolError";
  }
}
