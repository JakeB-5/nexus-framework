/**
 * Application Entry Point
 *
 * In a Nexus application, bootstrapping is handled by the CLI:
 *
 *   // nexus.config.ts
 *   export default defineApp({
 *     modules: [AuthModule, TodoModule],
 *     server: { port: 3000 },
 *   });
 *
 *   // Then run: npx nexus dev
 *
 * This entry point demonstrates the manual equivalent: initializing
 * the database, running migrations/seeds, and starting the HTTP server.
 */

import { createServer } from "node:http";
import { config } from "./config/app.config.js";
import { initDatabase } from "./database/connection.js";
import { seedDatabase } from "./database/seeds/seed-data.js";
import { handleRequest } from "./app.js";
import { logger } from "./middleware/logger.js";

// ---------------------------------------------------------------------------
// Bootstrap the application
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  logger.info("Starting Nexus Todo API example...");

  // Step 1: Initialize the database
  // In @nexus/orm: await db.connect()
  logger.info("Initializing database...");
  const db = initDatabase();

  // Step 2: Run seeds (populate with sample data)
  // In @nexus/orm: await db.runSeeds()
  const shouldSeed = process.env.SEED !== "false";
  if (shouldSeed) {
    await seedDatabase(db);
  }

  // Step 3: Create and start the HTTP server
  // In @nexus/http: await app.listen(config.server.port)
  const server = createServer((req, res) => {
    // handleRequest is async but createServer expects sync callback.
    // We handle errors inside handleRequest, so this void is safe.
    void handleRequest(req, res);
  });

  server.listen(config.server.port, config.server.host, () => {
    logger.info(
      `Server listening on http://${config.server.host}:${config.server.port}`,
    );
    logger.info("Available routes:");
    logger.info("  GET    /health           - Health check");
    logger.info("  POST   /auth/register    - Register a new user");
    logger.info("  POST   /auth/login       - Login and get JWT token");
    logger.info("  GET    /auth/me          - Get current user profile");
    logger.info("  GET    /todos            - List todos (with filters)");
    logger.info("  GET    /todos/stats      - Get todo statistics");
    logger.info("  GET    /todos/:id        - Get a single todo");
    logger.info("  POST   /todos            - Create a new todo");
    logger.info("  PUT    /todos/:id        - Update a todo");
    logger.info("  DELETE /todos/:id        - Delete a todo");
    logger.info("");
    logger.info("Try: curl http://localhost:3000/health");
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info("Server closed. Goodbye!");
      process.exit(0);
    });
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ---------------------------------------------------------------------------
// Run the application
// ---------------------------------------------------------------------------

bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
