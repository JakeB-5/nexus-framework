// @nexus/ws - Room management
import type { RoomInfo, RoomOptions } from "./types.js";

export class Room {
  public readonly name: string;
  public readonly metadata: Record<string, unknown>;
  public readonly createdAt: number;
  private readonly _clients: Set<string> = new Set();
  private readonly _maxClients: number;

  constructor(name: string, options?: RoomOptions) {
    this.name = name;
    this.metadata = options?.metadata ?? {};
    this.createdAt = Date.now();
    this._maxClients = options?.maxClients ?? Infinity;
  }

  add(clientId: string): boolean {
    if (this._clients.size >= this._maxClients) {
      return false;
    }
    this._clients.add(clientId);
    return true;
  }

  remove(clientId: string): boolean {
    return this._clients.delete(clientId);
  }

  has(clientId: string): boolean {
    return this._clients.has(clientId);
  }

  get size(): number {
    return this._clients.size;
  }

  get clients(): ReadonlySet<string> {
    return this._clients;
  }

  get isEmpty(): boolean {
    return this._clients.size === 0;
  }

  getInfo(): RoomInfo {
    return {
      name: this.name,
      size: this._clients.size,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
    };
  }

  getClientIds(): string[] {
    return Array.from(this._clients);
  }
}

export class RoomManager {
  private readonly _rooms: Map<string, Room> = new Map();

  create(name: string, options?: RoomOptions): Room {
    let room = this._rooms.get(name);
    if (!room) {
      room = new Room(name, options);
      this._rooms.set(name, room);
    }
    return room;
  }

  get(name: string): Room | undefined {
    return this._rooms.get(name);
  }

  delete(name: string): boolean {
    return this._rooms.delete(name);
  }

  has(name: string): boolean {
    return this._rooms.has(name);
  }

  join(clientId: string, roomName: string, options?: RoomOptions): boolean {
    const room = this.create(roomName, options);
    return room.add(clientId);
  }

  leave(clientId: string, roomName: string): boolean {
    const room = this._rooms.get(roomName);
    if (!room) {
      return false;
    }
    const removed = room.remove(clientId);
    // Clean up empty rooms
    if (room.isEmpty) {
      this._rooms.delete(roomName);
    }
    return removed;
  }

  leaveAll(clientId: string): string[] {
    const leftRooms: string[] = [];
    for (const [name, room] of this._rooms) {
      if (room.remove(clientId)) {
        leftRooms.push(name);
        if (room.isEmpty) {
          this._rooms.delete(name);
        }
      }
    }
    return leftRooms;
  }

  getClientRooms(clientId: string): string[] {
    const rooms: string[] = [];
    for (const [name, room] of this._rooms) {
      if (room.has(clientId)) {
        rooms.push(name);
      }
    }
    return rooms;
  }

  getRoomClients(roomName: string): string[] {
    const room = this._rooms.get(roomName);
    return room ? room.getClientIds() : [];
  }

  broadcast(
    roomName: string,
    sendFn: (clientId: string) => void,
    excludeClientId?: string,
  ): number {
    const room = this._rooms.get(roomName);
    if (!room) {
      return 0;
    }

    let count = 0;
    for (const clientId of room.clients) {
      if (clientId !== excludeClientId) {
        sendFn(clientId);
        count++;
      }
    }
    return count;
  }

  list(): RoomInfo[] {
    return Array.from(this._rooms.values()).map((room) => room.getInfo());
  }

  get size(): number {
    return this._rooms.size;
  }

  clear(): void {
    this._rooms.clear();
  }
}
