// @nexus/storage - StorageManager class

import { Disk } from "./disk.js";
import { StorageError } from "./errors.js";

/**
 * StorageManager - manages multiple named disks
 */
export class StorageManager {
  private readonly _disks: Map<string, Disk> = new Map();
  private _defaultDisk = "default";

  /**
   * Register a disk
   */
  register(name: string, disk: Disk): void {
    this._disks.set(name, disk);
  }

  /**
   * Get a named disk instance
   */
  disk(name?: string): Disk {
    const diskName = name ?? this._defaultDisk;
    const d = this._disks.get(diskName);
    if (!d) {
      throw new StorageError(`Disk "${diskName}" not found`, { code: "DISK_NOT_FOUND" });
    }
    return d;
  }

  /**
   * Set the default disk name
   */
  setDefault(name: string): void {
    this._defaultDisk = name;
  }

  /**
   * Get all registered disk names
   */
  getRegisteredDisks(): string[] {
    return [...this._disks.keys()];
  }

  /**
   * Check if a disk is registered
   */
  hasDisk(name: string): boolean {
    return this._disks.has(name);
  }
}
