// @nexus/storage - Module integration

import { StorageManager } from "./storage-manager.js";
import { Disk } from "./disk.js";
import { MemoryAdapter } from "./adapters/memory-adapter.js";
import { LocalAdapter } from "./adapters/local-adapter.js";
import type { DiskConfig, StorageOptions } from "./types.js";

/**
 * Storage module - factory for creating storage managers
 */
export class StorageModule {
  /**
   * Create a StorageManager from configuration
   */
  static create(options: StorageOptions): StorageManager {
    const manager = new StorageManager();

    for (const [name, config] of Object.entries(options.disks)) {
      const disk = StorageModule.createDisk(name, config);
      manager.register(name, disk);
    }

    if (options.default) {
      manager.setDefault(options.default);
    }

    return manager;
  }

  /**
   * Create a single disk from config
   */
  static createDisk(name: string, config: DiskConfig): Disk {
    const adapter = StorageModule.createAdapter(config);
    return new Disk(name, adapter, { baseUrl: config.baseUrl });
  }

  /**
   * Create an adapter from config
   */
  static createAdapter(config: DiskConfig): MemoryAdapter | LocalAdapter {
    switch (config.adapter) {
      case "memory":
        return new MemoryAdapter();
      case "local":
        return new LocalAdapter(config.basePath ?? "./storage");
    }
  }

  /**
   * Create a memory-only storage manager for testing
   */
  static createMemory(name = "default"): { manager: StorageManager; disk: Disk; adapter: MemoryAdapter } {
    const adapter = new MemoryAdapter();
    const disk = new Disk(name, adapter);
    const manager = new StorageManager();
    manager.register(name, disk);
    return { manager, disk, adapter };
  }
}
