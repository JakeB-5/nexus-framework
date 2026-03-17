// @nexus/ws - WebSocket with rooms, broadcasting, typed events
export { WebSocketServer } from "./ws-server.js";
export { WsClient } from "./ws-client.js";
export { Room, RoomManager } from "./room.js";
export {
  encodeMessage,
  decodeMessage,
  createAck,
  isAck,
  createPing,
  createPong,
  isPing,
  isPong,
} from "./protocol.js";
export {
  BasicWsAdapter,
  generateAcceptKey,
  isWebSocketUpgrade,
  rejectUpgrade,
  WsReadyState,
} from "./adapter.js";
export type { WsAdapter, WsSocket } from "./adapter.js";
export { WsModule, WS_SERVER_TOKEN } from "./ws-module.js";
export type { WsModuleOptions } from "./ws-module.js";
export { WebSocketError, ConnectionError, ProtocolError } from "./errors.js";
export type {
  WsServerOptions,
  WsMessage,
  WsClientInfo,
  RoomOptions,
  RoomInfo,
  WsEventHandler,
  WsConnectionHandler,
  WsErrorHandler,
  WsCloseHandler,
  WsClientInterface,
} from "./types.js";
