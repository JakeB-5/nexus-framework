// @nexus/ws - Room management for WebSocket connections

import type { RoomInfo, RoomOptions } from "./types.js";

/**
 * Manages WebSocket rooms for grouping and broadcasting.
 * Rooms are logical groupings of client IDs.
 */
export class RoomManager {
  private rooms = new Map<
    string,
    {
      clients: Set<string>;
      metadata: Record<string, unknown>;
      maxClients: number;
      createdAt: number;
    }
  >();

  /**
   * Create a room if it doesn't exist.
   */
  createRoom(name: string, options?: RoomOptions): void {
    if (this.rooms.has(name)) return;

    this.rooms.set(name, {
      clients: new Set(),
      metadata: options?.metadata ?? {},
      maxClients: options?.maxClients ?? 0,
      createdAt: Date.now(),
    });
  }

  /**
   * Add a client to a room. Creates the room if it doesn't exist.
   * Returns true if added, false if room is full.
   */
  join(roomName: string, clientId: string): boolean {
    let room = this.rooms.get(roomName);

    if (!room) {
      room = {
        clients: new Set(),
        metadata: {},
        maxClients: 0,
        createdAt: Date.now(),
      };
      this.rooms.set(roomName, room);
    }

    if (room.maxClients > 0 && room.clients.size >= room.maxClients) {
      return false;
    }

    room.clients.add(clientId);
    return true;
  }

  /**
   * Remove a client from a room.
   * Cleans up the room if it becomes empty.
   */
  leave(roomName: string, clientId: string): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    room.clients.delete(clientId);

    if (room.clients.size === 0) {
      this.rooms.delete(roomName);
    }
  }

  /**
   * Remove a client from all rooms.
   */
  leaveAll(clientId: string): void {
    for (const [name, room] of this.rooms) {
      room.clients.delete(clientId);
      if (room.clients.size === 0) {
        this.rooms.delete(name);
      }
    }
  }

  /**
   * Get all client IDs in a room.
   */
  getClients(roomName: string): ReadonlySet<string> {
    return this.rooms.get(roomName)?.clients ?? new Set();
  }

  /**
   * Get all room names a client belongs to.
   */
  getClientRooms(clientId: string): string[] {
    const result: string[] = [];
    for (const [name, room] of this.rooms) {
      if (room.clients.has(clientId)) {
        result.push(name);
      }
    }
    return result;
  }

  /**
   * Check if a room exists.
   */
  hasRoom(name: string): boolean {
    return this.rooms.has(name);
  }

  /**
   * Check if a client is in a room.
   */
  isInRoom(roomName: string, clientId: string): boolean {
    return this.rooms.get(roomName)?.clients.has(clientId) ?? false;
  }

  /**
   * Get room info.
   */
  getRoomInfo(name: string): RoomInfo | undefined {
    const room = this.rooms.get(name);
    if (!room) return undefined;

    return {
      name,
      size: room.clients.size,
      metadata: { ...room.metadata },
      createdAt: room.createdAt,
    };
  }

  /**
   * Get all room names.
   */
  getRoomNames(): string[] {
    return [...this.rooms.keys()];
  }

  /**
   * Get total room count.
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Delete a room and return all its client IDs.
   */
  deleteRoom(name: string): Set<string> {
    const room = this.rooms.get(name);
    if (!room) return new Set();

    const clients = new Set(room.clients);
    this.rooms.delete(name);
    return clients;
  }

  /**
   * Clear all rooms.
   */
  clear(): void {
    this.rooms.clear();
  }
}
