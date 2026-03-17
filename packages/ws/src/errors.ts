// @nexus/ws - Error classes

export class WebSocketError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "WebSocketError";
    this.code = code ?? "WS_ERROR";
    this.context = context;
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
