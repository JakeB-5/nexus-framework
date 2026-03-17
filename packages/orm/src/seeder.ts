// @nexus/orm - Database seeding

import type { Seeder, DatabaseConnectionInterface } from "./types.js";

/**
 * Seeder runner - manages executing seed data
 */
export class SeederRunner {
  private readonly _seeders: Seeder[] = [];

  constructor(_connection: DatabaseConnectionInterface) {}

  /**
   * Register a seeder
   */
  register(seeder: Seeder): void {
    this._seeders.push(seeder);
  }

  /**
   * Register multiple seeders
   */
  registerMany(seeders: Seeder[]): void {
    this._seeders.push(...seeders);
  }

  /**
   * Run all registered seeders
   */
  async run(): Promise<string[]> {
    const executed: string[] = [];

    for (const seeder of this._seeders) {
      await seeder.run();
      executed.push(seeder.name);
    }

    return executed;
  }

  /**
   * Run a specific seeder by name
   */
  async runByName(name: string): Promise<void> {
    const seeder = this._seeders.find((s) => s.name === name);
    if (!seeder) {
      throw new Error(`Seeder "${name}" not found`);
    }
    await seeder.run();
  }

  /**
   * Get all seeder names
   */
  getNames(): string[] {
    return this._seeders.map((s) => s.name);
  }
}
