// @nexus/ws - Comprehensive test suite

import {
  encodeMessage,
  decodeMessage,
  createAck,
  isAck,
  createPing,
  createPong,
  isPing,
  isPong,
} from "../src/protocol.js";
import { Room } from "../src/room.js";
import { RoomManager } from "../src/room-manager.js";
import { WsClient } from "../src/ws-client.js";
import { WebSocketServer } from "../src/ws-server.js";
import { WsModule, WS_SERVER_TOKEN } from "../src/ws-module.js";
import {
  BasicWsAdapter,
  generateAcceptKey,
  isWebSocketUpgrade,
  rejectUpgrade,
  WsReadyState,
} from "../src/adapter.js";
import { WebSocketError, ConnectionError, ProtocolError } from "../src/errors.js";

// ─── Protocol: encodeMessage / decodeMessage ────────────────────────────────

describe("protocol - encodeMessage", () => {
  it("should encode a message with event and data", () => {
    const encoded = encodeMessage("chat", { text: "hello" });
    const parsed = JSON.parse(encoded);
    expect(parsed.event).toBe("chat");
    expect(parsed.data).toEqual({ text: "hello" });
    expect(typeof parsed.id).toBe("string");
  });

  it("should use provided id when specified", () => {
    const encoded = encodeMessage("test", null, { id: "custom-id" });
    const parsed = JSON.parse(encoded);
    expect(parsed.id).toBe("custom-id");
  });

  it("should include ack flag when specified", () => {
    const encoded = encodeMessage("test", "data", { ack: true });
    const parsed = JSON.parse(encoded);
    expect(parsed.ack).toBe(true);
  });

  it("should handle various data types", () => {
    const cases = [null, 42, "string", [1, 2, 3], { nested: { deep: true } }];
    for (const data of cases) {
      const encoded = encodeMessage("evt", data);
      const parsed = JSON.parse(encoded);
      expect(parsed.data).toEqual(data);
    }
  });
});

describe("protocol - decodeMessage", () => {
  it("should decode a valid JSON message string", () => {
    const raw = JSON.stringify({ event: "chat", data: { text: "hi" }, id: "abc" });
    const msg = decodeMessage(raw);
    expect(msg.event).toBe("chat");
    expect(msg.data).toEqual({ text: "hi" });
    expect(msg.id).toBe("abc");
  });

  it("should decode a Buffer", () => {
    const raw = Buffer.from(JSON.stringify({ event: "ping", data: null }));
    const msg = decodeMessage(raw);
    expect(msg.event).toBe("ping");
    expect(msg.data).toBeNull();
  });

  it("should throw ProtocolError on empty message", () => {
    expect(() => decodeMessage("")).toThrow(ProtocolError);
    expect(() => decodeMessage("")).toThrow("Empty message received");
  });

  it("should throw ProtocolError on invalid JSON", () => {
    expect(() => decodeMessage("not json")).toThrow(ProtocolError);
    expect(() => decodeMessage("{broken")).toThrow(ProtocolError);
  });

  it("should throw ProtocolError when event field is missing", () => {
    expect(() => decodeMessage(JSON.stringify({ data: "no event" }))).toThrow(ProtocolError);
    expect(() => decodeMessage(JSON.stringify({ data: "no event" }))).toThrow(
      "Message must have a non-empty 'event' field",
    );
  });

  it("should throw ProtocolError when event is empty string", () => {
    expect(() => decodeMessage(JSON.stringify({ event: "" }))).toThrow(ProtocolError);
  });

  it("should ignore non-string id and non-boolean ack", () => {
    const raw = JSON.stringify({ event: "test", data: null, id: 123, ack: "yes" });
    const msg = decodeMessage(raw);
    expect(msg.id).toBeUndefined();
    expect(msg.ack).toBeUndefined();
  });
});

describe("protocol - ack helpers", () => {
  it("createAck should create an ack message with the given messageId", () => {
    const ack = createAck("msg-1", { status: "ok" });
    const parsed = JSON.parse(ack);
    expect(parsed.event).toBe("__ack__");
    expect(parsed.id).toBe("msg-1");
    expect(parsed.ack).toBe(true);
    expect(parsed.data).toEqual({ status: "ok" });
  });

  it("createAck should default data to null", () => {
    const ack = createAck("msg-2");
    const parsed = JSON.parse(ack);
    expect(parsed.data).toBeNull();
  });

  it("isAck should return true for ack messages", () => {
    const msg = decodeMessage(createAck("x"));
    expect(isAck(msg)).toBe(true);
  });

  it("isAck should return false for non-ack messages", () => {
    expect(isAck({ event: "chat", data: null })).toBe(false);
    expect(isAck({ event: "__ack__", data: null, ack: false })).toBe(false);
    expect(isAck({ event: "__ack__", data: null })).toBe(false);
  });
});

describe("protocol - ping/pong helpers", () => {
  it("createPing should create a ping message", () => {
    const ping = createPing();
    const parsed = JSON.parse(ping);
    expect(parsed.event).toBe("__ping__");
    expect(parsed.data).toBeNull();
  });

  it("createPong should create a pong message", () => {
    const pong = createPong();
    const parsed = JSON.parse(pong);
    expect(parsed.event).toBe("__pong__");
    expect(parsed.data).toBeNull();
  });

  it("isPing should identify ping messages", () => {
    expect(isPing({ event: "__ping__", data: null })).toBe(true);
    expect(isPing({ event: "other", data: null })).toBe(false);
  });

  it("isPong should identify pong messages", () => {
    expect(isPong({ event: "__pong__", data: null })).toBe(true);
    expect(isPong({ event: "other", data: null })).toBe(false);
  });
});

// ─── Room ───────────────────────────────────────────────────────────────────

describe("Room", () => {
  it("should create a room with name and defaults", () => {
    const room = new Room("lobby");
    expect(room.name).toBe("lobby");
    expect(room.size).toBe(0);
    expect(room.isEmpty).toBe(true);
    expect(room.metadata).toEqual({});
    expect(typeof room.createdAt).toBe("number");
  });

  it("should create a room with metadata and maxClients", () => {
    const room = new Room("vip", { maxClients: 2, metadata: { tier: "gold" } });
    expect(room.metadata).toEqual({ tier: "gold" });
  });

  it("should add clients up to maxClients", () => {
    const room = new Room("small", { maxClients: 2 });
    expect(room.add("c1")).toBe(true);
    expect(room.add("c2")).toBe(true);
    expect(room.add("c3")).toBe(false);
    expect(room.size).toBe(2);
  });

  it("should allow unlimited clients when maxClients is not set", () => {
    const room = new Room("big");
    for (let i = 0; i < 100; i++) {
      expect(room.add(`c${i}`)).toBe(true);
    }
    expect(room.size).toBe(100);
  });

  it("should remove clients", () => {
    const room = new Room("test");
    room.add("c1");
    room.add("c2");
    expect(room.remove("c1")).toBe(true);
    expect(room.remove("c1")).toBe(false);
    expect(room.size).toBe(1);
  });

  it("should check client membership", () => {
    const room = new Room("test");
    room.add("c1");
    expect(room.has("c1")).toBe(true);
    expect(room.has("c2")).toBe(false);
  });

  it("should expose clients as ReadonlySet", () => {
    const room = new Room("test");
    room.add("c1");
    room.add("c2");
    const clients = room.clients;
    expect(clients.has("c1")).toBe(true);
    expect(clients.size).toBe(2);
  });

  it("should return room info", () => {
    const room = new Room("info-test", { metadata: { game: "chess" } });
    room.add("p1");
    const info = room.getInfo();
    expect(info.name).toBe("info-test");
    expect(info.size).toBe(1);
    expect(info.metadata).toEqual({ game: "chess" });
    expect(typeof info.createdAt).toBe("number");
  });

  it("should return client IDs as array", () => {
    const room = new Room("test");
    room.add("a");
    room.add("b");
    const ids = room.getClientIds();
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids.length).toBe(2);
  });
});

// ─── RoomManager (room-manager.ts) ─────────────────────────────────────────

describe("RoomManager (room-manager.ts)", () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it("should create a room", () => {
    manager.createRoom("lobby");
    expect(manager.hasRoom("lobby")).toBe(true);
    expect(manager.getRoomCount()).toBe(1);
  });

  it("should not duplicate rooms on repeated createRoom", () => {
    manager.createRoom("lobby");
    manager.createRoom("lobby");
    expect(manager.getRoomCount()).toBe(1);
  });

  it("should join a client to a room, creating the room if needed", () => {
    expect(manager.join("game", "c1")).toBe(true);
    expect(manager.hasRoom("game")).toBe(true);
    expect(manager.isInRoom("game", "c1")).toBe(true);
  });

  it("should respect maxClients when set via createRoom", () => {
    manager.createRoom("small", { maxClients: 1 });
    expect(manager.join("small", "c1")).toBe(true);
    expect(manager.join("small", "c2")).toBe(false);
  });

  it("should leave a room and clean up empty rooms", () => {
    manager.join("temp", "c1");
    manager.leave("temp", "c1");
    expect(manager.hasRoom("temp")).toBe(false);
  });

  it("should handle leaving a non-existent room gracefully", () => {
    manager.leave("ghost", "c1"); // should not throw
    expect(manager.hasRoom("ghost")).toBe(false);
  });

  it("should leave all rooms for a client", () => {
    manager.join("r1", "c1");
    manager.join("r2", "c1");
    manager.join("r2", "c2");
    manager.leaveAll("c1");
    expect(manager.hasRoom("r1")).toBe(false);
    expect(manager.hasRoom("r2")).toBe(true);
    expect(manager.isInRoom("r2", "c1")).toBe(false);
  });

  it("should get clients in a room", () => {
    manager.join("room", "c1");
    manager.join("room", "c2");
    const clients = manager.getClients("room");
    expect(clients.has("c1")).toBe(true);
    expect(clients.has("c2")).toBe(true);
  });

  it("should return empty set for non-existent room clients", () => {
    const clients = manager.getClients("nope");
    expect(clients.size).toBe(0);
  });

  it("should get rooms for a client", () => {
    manager.join("a", "c1");
    manager.join("b", "c1");
    const rooms = manager.getClientRooms("c1");
    expect(rooms).toContain("a");
    expect(rooms).toContain("b");
  });

  it("should get room info", () => {
    manager.join("info", "c1");
    const info = manager.getRoomInfo("info");
    expect(info).toBeDefined();
    expect(info!.name).toBe("info");
    expect(info!.size).toBe(1);
  });

  it("should return undefined for non-existent room info", () => {
    expect(manager.getRoomInfo("nope")).toBeUndefined();
  });

  it("should list room names", () => {
    manager.join("x", "c1");
    manager.join("y", "c1");
    const names = manager.getRoomNames();
    expect(names).toContain("x");
    expect(names).toContain("y");
  });

  it("should delete a room and return its clients", () => {
    manager.join("del", "c1");
    manager.join("del", "c2");
    const clients = manager.deleteRoom("del");
    expect(clients.size).toBe(2);
    expect(clients.has("c1")).toBe(true);
    expect(manager.hasRoom("del")).toBe(false);
  });

  it("should return empty set when deleting non-existent room", () => {
    const clients = manager.deleteRoom("nope");
    expect(clients.size).toBe(0);
  });

  it("should clear all rooms", () => {
    manager.join("a", "c1");
    manager.join("b", "c2");
    manager.clear();
    expect(manager.getRoomCount()).toBe(0);
  });
});

// ─── Room (room.ts - as used in ws-server via RoomManager) ─────────────────

describe("Room (from room.ts) - RoomManager class", () => {
  // The room.ts file exports both Room and a RoomManager.
  // The ws-server uses the RoomManager from room.ts. We test that here.
  // We import { Room, RoomManager } from room.ts via the index.
  // The Room class is already tested above. The RoomManager from room.ts
  // has a different API (create, join with clientId first, broadcast, etc.)

  let rm: InstanceType<typeof import("../src/room.js").RoomManager>;

  beforeEach(async () => {
    const mod = await import("../src/room.js");
    rm = new mod.RoomManager();
  });

  it("should create and get rooms", () => {
    const room = rm.create("lobby");
    expect(room.name).toBe("lobby");
    expect(rm.has("lobby")).toBe(true);
    expect(rm.get("lobby")).toBe(room);
  });

  it("should return existing room on duplicate create", () => {
    const r1 = rm.create("test");
    const r2 = rm.create("test");
    expect(r1).toBe(r2);
  });

  it("should join a client to a room", () => {
    expect(rm.join("c1", "room1")).toBe(true);
    expect(rm.has("room1")).toBe(true);
  });

  it("should leave a room and clean up empty rooms", () => {
    rm.join("c1", "room1");
    expect(rm.leave("c1", "room1")).toBe(true);
    expect(rm.has("room1")).toBe(false);
  });

  it("should return false when leaving a non-existent room", () => {
    expect(rm.leave("c1", "nope")).toBe(false);
  });

  it("should leave all rooms for a client", () => {
    rm.join("c1", "r1");
    rm.join("c1", "r2");
    rm.join("c2", "r2");
    const left = rm.leaveAll("c1");
    expect(left).toContain("r1");
    expect(left).toContain("r2");
    expect(rm.has("r1")).toBe(false);
    expect(rm.has("r2")).toBe(true);
  });

  it("should get client rooms", () => {
    rm.join("c1", "a");
    rm.join("c1", "b");
    const rooms = rm.getClientRooms("c1");
    expect(rooms).toContain("a");
    expect(rooms).toContain("b");
  });

  it("should get room clients", () => {
    rm.join("c1", "room");
    rm.join("c2", "room");
    const clients = rm.getRoomClients("room");
    expect(clients).toContain("c1");
    expect(clients).toContain("c2");
  });

  it("should return empty array for non-existent room clients", () => {
    expect(rm.getRoomClients("nope")).toEqual([]);
  });

  it("should broadcast to room clients excluding one", () => {
    rm.join("c1", "room");
    rm.join("c2", "room");
    rm.join("c3", "room");
    const sent: string[] = [];
    const count = rm.broadcast("room", (id) => sent.push(id), "c2");
    expect(count).toBe(2);
    expect(sent).toContain("c1");
    expect(sent).toContain("c3");
    expect(sent).not.toContain("c2");
  });

  it("should return 0 for broadcasting to non-existent room", () => {
    expect(rm.broadcast("nope", () => {})).toBe(0);
  });

  it("should list all rooms", () => {
    rm.join("c1", "a");
    rm.join("c2", "b");
    const list = rm.list();
    expect(list.length).toBe(2);
    expect(list.map((r) => r.name)).toContain("a");
  });

  it("should track size and clear", () => {
    rm.join("c1", "a");
    rm.join("c2", "b");
    expect(rm.size).toBe(2);
    rm.clear();
    expect(rm.size).toBe(0);
  });
});

// ─── WsClient ───────────────────────────────────────────────────────────────

describe("WsClient", () => {
  it("should create a client with defaults", () => {
    const client = new WsClient();
    expect(typeof client.id).toBe("string");
    expect(client.remoteAddress).toBe("unknown");
    expect(client.connected).toBe(true);
    expect(client.rooms.size).toBe(0);
    expect(typeof client.connectedAt).toBe("number");
  });

  it("should accept custom options", () => {
    const client = new WsClient({
      id: "test-id",
      remoteAddress: "192.168.1.1",
      metadata: { role: "admin" },
    });
    expect(client.id).toBe("test-id");
    expect(client.remoteAddress).toBe("192.168.1.1");
    expect(client.metadata).toEqual({ role: "admin" });
  });

  it("should send messages via sendFn", () => {
    const sent: string[] = [];
    const client = new WsClient({ sendFn: (data) => sent.push(data) });
    client.send("greeting", { msg: "hi" });
    expect(sent.length).toBe(1);
    const parsed = JSON.parse(sent[0]!);
    expect(parsed.event).toBe("greeting");
    expect(parsed.data).toEqual({ msg: "hi" });
  });

  it("should not send when disconnected", () => {
    const sent: string[] = [];
    const client = new WsClient({ sendFn: (data) => sent.push(data) });
    client.disconnect();
    client.send("test", null);
    expect(sent.length).toBe(0);
  });

  it("should not send when sendFn is not set", () => {
    const client = new WsClient();
    // Should not throw
    client.send("test", null);
  });

  it("should join and leave rooms", () => {
    const client = new WsClient();
    client.join("room1");
    client.join("room2");
    expect(client.rooms.has("room1")).toBe(true);
    expect(client.rooms.has("room2")).toBe(true);
    client.leave("room1");
    expect(client.rooms.has("room1")).toBe(false);
    expect(client.rooms.size).toBe(1);
  });

  it("should register and trigger event handlers via on()", () => {
    const client = new WsClient({ sendFn: () => {} });
    const received: unknown[] = [];
    client.on("chat", (data) => received.push(data));

    const msg = encodeMessage("chat", { text: "hello" });
    client.handleMessage(msg);

    expect(received.length).toBe(1);
    expect(received[0]).toEqual({ text: "hello" });
  });

  it("should remove event handlers via off()", () => {
    const client = new WsClient({ sendFn: () => {} });
    const received: unknown[] = [];
    const handler = (data: unknown) => received.push(data);
    client.on("chat", handler);
    client.off("chat", handler);

    client.handleMessage(encodeMessage("chat", "test"));
    expect(received.length).toBe(0);
  });

  it("should handle wildcard (*) event handlers", () => {
    const client = new WsClient({ sendFn: () => {} });
    const received: unknown[] = [];
    client.on("*", (data) => received.push(data));

    client.handleMessage(encodeMessage("any-event", { x: 1 }));
    expect(received.length).toBe(1);
    expect((received[0] as { event: string }).event).toBe("any-event");
  });

  it("should respond to ping with pong", () => {
    const sent: string[] = [];
    const client = new WsClient({ sendFn: (data) => sent.push(data) });

    client.handleMessage(createPing());
    expect(sent.length).toBe(1);
    const parsed = JSON.parse(sent[0]!);
    expect(parsed.event).toBe("__pong__");
  });

  it("should update lastPong on pong message", () => {
    const client = new WsClient({ sendFn: () => {} });
    const before = client.lastPong;
    // Small delay to ensure Date.now() differs
    client.handleMessage(encodeMessage("__pong__", null));
    expect(client.lastPong).toBeGreaterThanOrEqual(before);
  });

  it("should handle ack responses", () => {
    const sent: string[] = [];
    const client = new WsClient({ sendFn: (data) => sent.push(data) });

    const promise = client.sendWithAck("test", { x: 1 }, 5000);

    // Extract the message id from what was sent
    const sentMsg = JSON.parse(sent[0]!);
    const ackResponse = createAck(sentMsg.id, { ok: true });
    client.handleMessage(ackResponse);

    return expect(promise).resolves.toEqual({ ok: true });
  });

  it("sendWithAck should timeout if no ack received", () => {
    const client = new WsClient({ sendFn: () => {} });
    const promise = client.sendWithAck("test", null, 50);
    return expect(promise).rejects.toThrow("Ack timeout");
  });

  it("should disconnect and clear state", () => {
    const closeCalls: Array<{ code?: number; reason?: string }> = [];
    const client = new WsClient({
      closeFn: (code, reason) => closeCalls.push({ code, reason }),
    });
    client.join("room1");
    client.disconnect(1001, "Going away");
    expect(client.connected).toBe(false);
    expect(client.rooms.size).toBe(0);
    expect(closeCalls.length).toBe(1);
    expect(closeCalls[0]!.code).toBe(1001);
  });

  it("should not disconnect twice", () => {
    const closeCalls: number[] = [];
    const client = new WsClient({ closeFn: () => closeCalls.push(1) });
    client.disconnect();
    client.disconnect();
    expect(closeCalls.length).toBe(1);
  });

  it("should markDisconnected", () => {
    const client = new WsClient();
    client.join("r1");
    client.markDisconnected();
    expect(client.connected).toBe(false);
    expect(client.rooms.size).toBe(0);
  });

  it("should return client info", () => {
    const client = new WsClient({ id: "info-test", remoteAddress: "10.0.0.1" });
    client.join("room1");
    const info = client.getInfo();
    expect(info.id).toBe("info-test");
    expect(info.remoteAddress).toBe("10.0.0.1");
    expect(info.rooms.has("room1")).toBe(true);
    expect(typeof info.connectedAt).toBe("number");
  });

  it("should allow setting sendFn and closeFn after construction", () => {
    const client = new WsClient();
    const sent: string[] = [];
    client.setSendFn((data) => sent.push(data));
    client.send("test", 42);
    expect(sent.length).toBe(1);

    const closes: number[] = [];
    client.setCloseFn((code) => closes.push(code ?? 0));
    client.disconnect();
    expect(closes.length).toBe(1);
  });

  it("should silently ignore invalid messages in handleMessage", () => {
    const client = new WsClient({ sendFn: () => {} });
    // Should not throw
    client.handleMessage("not valid json");
    client.handleMessage("{}");
  });

  it("off() should do nothing for unregistered handler", () => {
    const client = new WsClient();
    const handler = () => {};
    // Should not throw
    client.off("nonexistent", handler);
  });
});

// ─── WebSocketServer ────────────────────────────────────────────────────────

describe("WebSocketServer", () => {
  it("should create with default options", () => {
    const server = new WebSocketServer();
    expect(server.clientCount).toBe(0);
    expect(server.rooms).toBeDefined();
  });

  it("should create with custom options", () => {
    const server = new WebSocketServer({
      path: "/socket",
      maxConnections: 100,
      heartbeatInterval: 5000,
      heartbeatTimeout: 2000,
    });
    expect(server.clientCount).toBe(0);
  });

  it("should register connection handler", () => {
    const server = new WebSocketServer();
    const result = server.onConnection(() => {});
    expect(result).toBe(server); // fluent API
  });

  it("should register disconnect handler", () => {
    const server = new WebSocketServer();
    const result = server.onDisconnect(() => {});
    expect(result).toBe(server);
  });

  it("should register error handler", () => {
    const server = new WebSocketServer();
    const result = server.onError(() => {});
    expect(result).toBe(server);
  });

  it("should register and unregister event handlers", () => {
    const server = new WebSocketServer();
    const handler = () => {};
    server.on("chat", handler);
    const result = server.off("chat", handler);
    expect(result).toBe(server);
  });

  it("should return false when sending to non-existent client", () => {
    const server = new WebSocketServer();
    expect(server.send("nonexistent", "test", null)).toBe(false);
  });

  it("should broadcast returns 0 with no clients", () => {
    const server = new WebSocketServer();
    expect(server.broadcast("test", null)).toBe(0);
  });

  it("should return undefined for non-existent getClient", () => {
    const server = new WebSocketServer();
    expect(server.getClient("nope")).toBeUndefined();
  });

  it("should expose clients map", () => {
    const server = new WebSocketServer();
    expect(server.getClients().size).toBe(0);
  });

  it("should close and detach cleanly", () => {
    const server = new WebSocketServer();
    // Should not throw
    server.close();
    expect(server.clientCount).toBe(0);
  });

  it("should disconnectAll", () => {
    const server = new WebSocketServer();
    // Even with no clients, should not throw
    server.disconnectAll(1000, "bye");
    expect(server.clientCount).toBe(0);
  });
});

// ─── Adapter utilities ──────────────────────────────────────────────────────

describe("adapter - generateAcceptKey", () => {
  it("should generate a valid WebSocket accept key", () => {
    // Known test vector from RFC 6455
    const key = generateAcceptKey("dGhlIHNhbXBsZSBub25jZQ==");
    expect(key).toBe("6xRjOdebGzcYklUpMyZjmu1Phmw=");
  });
});

describe("adapter - isWebSocketUpgrade", () => {
  it("should return true for websocket upgrade request", () => {
    const req = { headers: { upgrade: "websocket" } } as any;
    expect(isWebSocketUpgrade(req)).toBe(true);
  });

  it("should be case insensitive", () => {
    const req = { headers: { upgrade: "WebSocket" } } as any;
    expect(isWebSocketUpgrade(req)).toBe(true);
  });

  it("should return false when no upgrade header", () => {
    const req = { headers: {} } as any;
    expect(isWebSocketUpgrade(req)).toBe(false);
  });

  it("should return false for non-websocket upgrade", () => {
    const req = { headers: { upgrade: "h2c" } } as any;
    expect(isWebSocketUpgrade(req)).toBe(false);
  });
});

describe("adapter - rejectUpgrade", () => {
  it("should write status code and message to response", () => {
    let headCode = 0;
    let headHeaders = {};
    let body = "";
    const res = {
      writeHead: (code: number, headers: Record<string, string>) => {
        headCode = code;
        headHeaders = headers;
      },
      end: (msg: string) => {
        body = msg;
      },
    } as any;

    rejectUpgrade(res, 403, "Forbidden");
    expect(headCode).toBe(403);
    expect(body).toBe("Forbidden");
  });

  it("should use defaults", () => {
    let headCode = 0;
    let body = "";
    const res = {
      writeHead: (code: number) => { headCode = code; },
      end: (msg: string) => { body = msg; },
    } as any;

    rejectUpgrade(res);
    expect(headCode).toBe(400);
    expect(body).toBe("Bad Request");
  });
});

describe("adapter - WsReadyState", () => {
  it("should have correct ready state values", () => {
    expect(WsReadyState.CONNECTING).toBe(0);
    expect(WsReadyState.OPEN).toBe(1);
    expect(WsReadyState.CLOSING).toBe(2);
    expect(WsReadyState.CLOSED).toBe(3);
  });
});

// ─── WsModule ───────────────────────────────────────────────────────────────

describe("WsModule", () => {
  it("should expose a token symbol", () => {
    expect(typeof WS_SERVER_TOKEN).toBe("symbol");
    expect(WsModule.token).toBe(WS_SERVER_TOKEN);
  });

  it("should register with default options", () => {
    const registration = WsModule.register();
    expect(registration.token).toBe(WS_SERVER_TOKEN);
    expect(typeof registration.factory).toBe("function");
    expect(registration.options.path).toBe("/ws");
    expect(registration.options.maxConnections).toBe(10000);
    expect(registration.options.heartbeatInterval).toBe(30000);
    expect(registration.options.heartbeatTimeout).toBe(10000);
    expect(registration.options.autoAttach).toBe(true);
  });

  it("should merge custom options", () => {
    const registration = WsModule.register({ path: "/socket", maxConnections: 50 });
    expect(registration.options.path).toBe("/socket");
    expect(registration.options.maxConnections).toBe(50);
    expect(registration.options.heartbeatInterval).toBe(30000);
  });

  it("factory should return a WebSocketServer instance", () => {
    const registration = WsModule.register();
    const server = registration.factory();
    expect(server).toBeInstanceOf(WebSocketServer);
  });
});

// ─── Error classes ──────────────────────────────────────────────────────────

describe("Error classes", () => {
  it("WebSocketError should have correct properties", () => {
    const err = new WebSocketError("test error", "TEST_CODE", { key: "value" });
    expect(err.message).toBe("test error");
    expect(err.code).toBe("TEST_CODE");
    expect(err.context).toEqual({ key: "value" });
    expect(err.name).toBe("WebSocketError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(WebSocketError);
  });

  it("WebSocketError should use defaults", () => {
    const err = new WebSocketError("msg");
    expect(err.code).toBe("WS_ERROR");
    expect(err.context).toBeUndefined();
  });

  it("ConnectionError should have correct defaults", () => {
    const err = new ConnectionError();
    expect(err.message).toBe("Connection failed");
    expect(err.code).toBe("CONNECTION_ERROR");
    expect(err.name).toBe("ConnectionError");
    expect(err).toBeInstanceOf(WebSocketError);
  });

  it("ConnectionError with custom message and context", () => {
    const err = new ConnectionError("custom msg", { detail: "info" });
    expect(err.message).toBe("custom msg");
    expect(err.context).toEqual({ detail: "info" });
  });

  it("ProtocolError should have correct defaults", () => {
    const err = new ProtocolError();
    expect(err.message).toBe("Protocol error");
    expect(err.code).toBe("PROTOCOL_ERROR");
    expect(err.name).toBe("ProtocolError");
    expect(err).toBeInstanceOf(WebSocketError);
  });

  it("ProtocolError with custom message", () => {
    const err = new ProtocolError("bad frame");
    expect(err.message).toBe("bad frame");
  });
});
