// @nexus/ws - Type definitions
import type { IncomingMessage } from "node:http";

export interface WsServerOptions {
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  maxPayloadSize?: number;
  authHandler?: (req: IncomingMessage) => boolean | Promise<boolean>;
}

export interface WsMessage {
  event: string;
  data: unknown;
  id?: string;
  ack?: boolean;
}

export interface WsClientInfo {
  id: string;
  remoteAddress: string;
  connectedAt: number;
  rooms: Set<string>;
  metadata: Record<string, unknown>;
}

export interface RoomOptions {
  maxClients?: number;
  metadata?: Record<string, unknown>;
}

export interface RoomInfo {
  name: string;
  size: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export type WsEventHandler = (data: unknown, clientId: string) => void | Promise<void>;
export type WsConnectionHandler = (clientId: string) => void | Promise<void>;
export type WsErrorHandler = (error: Error, clientId: string) => void | Promise<void>;
export type WsCloseHandler = (code: number, reason: string, clientId: string) => void | Promise<void>;

export interface WsClientInterface {
  readonly id: string;
  readonly rooms: ReadonlySet<string>;
  readonly connected: boolean;
  send(event: string, data: unknown): void;
  join(room: string): void;
  leave(room: string): void;
  disconnect(code?: number, reason?: string): void;
}
