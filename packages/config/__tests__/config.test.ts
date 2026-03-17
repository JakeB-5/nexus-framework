import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  ConfigService,
  ConfigNotFoundError,
  ConfigValidationError,
  defineConfig,
  extractDefaults,
  validateConfig,
  assertConfigValid,
  EnvLoader,
  FileLoader,
  parseEnvContent,
  ConfigModule,
} from "../src/index.js";

describe("ConfigService", () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
  });

  describe("get / set / has", () => {
    it("should get a simple value", async () => {
      await service.loadFrom({ port: 3000 }, []);
      expect(service.get("port")).toBe(3000);
    });

    it("should get a nested value via dot-notation", async () => {
      await service.loadFrom({ database: { host: "localhost", port: 5432 } }, []);
      expect(service.get("database.host")).toBe("localhost");
      expect(service.get("database.port")).toBe(5432);
    });

    it("should return default value when key is missing", async () => {
      await service.loadFrom({}, []);
      expect(service.get("missing", "fallback")).toBe("fallback");
    });

    it("should return undefined when key is missing and no default", async () => {
      await service.loadFrom({}, []);
      expect(service.get("missing")).toBeUndefined();
    });

    it("should check existence with has()", async () => {
      await service.loadFrom({ exists: true }, []);
      expect(service.has("exists")).toBe(true);
      expect(service.has("nope")).toBe(false);
    });

    it("should check nested existence", async () => {
      await service.loadFrom({ a: { b: { c: 1 } } }, []);
      expect(service.has("a.b.c")).toBe(true);
      expect(service.has("a.b.d")).toBe(false);
    });

    it("should set runtime overrides", async () => {
      await service.loadFrom({ port: 3000 }, []);
      service.set("port", 8080);
      expect(service.get("port")).toBe(8080);
    });

    it("should set nested values", async () => {
      await service.loadFrom({}, []);
      service.set("database.host", "remotehost");
      expect(service.get("database.host")).toBe("remotehost");
    });

    it("should get all config", async () => {
      await service.loadFrom({ a: 1, b: 2 }, []);
      const all = service.getAll();
      expect(all).toEqual({ a: 1, b: 2 });
    });
  });

  describe("getOrThrow", () => {
    it("should return value when key exists", async () => {
      await service.loadFrom({ key: "value" }, []);
      expect(service.getOrThrow("key")).toBe("value");
    });

    it("should throw ConfigNotFoundError when key is missing", async () => {
      await service.loadFrom({}, []);
      expect(() => service.getOrThrow("missing")).toThrow(ConfigNotFoundError);
    });
  });

  describe("layered config", () => {
    it("should merge defaults with loaded config", async () => {
      const loader = {
        name: "test",
        load: () => ({ port: 8080 }),
      };

      await service.loadFrom({ port: 3000, host: "localhost" }, [loader]);
      expect(service.get("port")).toBe(8080); // Overridden by loader
      expect(service.get("host")).toBe("localhost"); // From defaults
    });

    it("should apply loaders in order (later wins)", async () => {
      const loader1 = { name: "l1", load: () => ({ port: 3000 }) };
      const loader2 = { name: "l2", load: () => ({ port: 8080 }) };

      await service.loadFrom({}, [loader1, loader2]);
      expect(service.get("port")).toBe(8080);
    });

    it("should deep merge nested config", async () => {
      const loader = {
        name: "test",
        load: () => ({ database: { port: 5433 } }),
      };

      await service.loadFrom(
        { database: { host: "localhost", port: 5432 } },
        [loader],
      );
      expect(service.get("database.host")).toBe("localhost");
      expect(service.get("database.port")).toBe(5433);
    });

    it("should merge additional config", async () => {
      await service.loadFrom({ a: 1 }, []);
      service.merge({ b: 2 });
      expect(service.get("a")).toBe(1);
      expect(service.get("b")).toBe(2);
    });
  });

  describe("schema validation", () => {
    it("should validate config against schema on load", async () => {
      const schema = defineConfig({
        port: { type: "number", required: true },
      });

      const svc = new ConfigService({ schema });
      await expect(svc.loadFrom({}, [])).rejects.toThrow(ConfigValidationError);
    });

    it("should pass validation for valid config", async () => {
      const schema = defineConfig({
        port: { type: "number", required: true },
      });

      const svc = new ConfigService({ schema });
      await svc.loadFrom({ port: 3000 }, []);
      expect(svc.get("port")).toBe(3000);
    });

    it("should apply schema defaults", async () => {
      const schema = defineConfig({
        port: { type: "number", default: 3000 },
      });

      const svc = new ConfigService({ schema });
      await svc.loadFrom({}, []);
      expect(svc.get("port")).toBe(3000);
    });
  });
});

describe("Schema utilities", () => {
  describe("defineConfig", () => {
    it("should return the schema as-is", () => {
      const schema = defineConfig({
        port: { type: "number", default: 3000 },
      });
      expect(schema.port.type).toBe("number");
    });
  });

  describe("extractDefaults", () => {
    it("should extract top-level defaults", () => {
      const defaults = extractDefaults({
        port: { type: "number", default: 3000 },
        host: { type: "string", default: "localhost" },
        debug: { type: "boolean" },
      });
      expect(defaults).toEqual({ port: 3000, host: "localhost" });
    });

    it("should extract nested defaults", () => {
      const defaults = extractDefaults({
        database: {
          type: "object",
          properties: {
            port: { type: "number", default: 5432 },
            host: { type: "string", default: "localhost" },
          },
        },
      });
      expect(defaults).toEqual({
        database: { port: 5432, host: "localhost" },
      });
    });
  });

  describe("validateConfig", () => {
    it("should validate required fields", () => {
      const errors = validateConfig(
        {},
        { name: { type: "string", required: true } },
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("name");
    });

    it("should validate type mismatch - string", () => {
      const errors = validateConfig(
        { name: 123 },
        { name: { type: "string" } },
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("Expected string");
    });

    it("should validate type mismatch - number", () => {
      const errors = validateConfig(
        { port: "abc" },
        { port: { type: "number" } },
      );
      expect(errors).toHaveLength(1);
    });

    it("should validate type mismatch - boolean", () => {
      const errors = validateConfig(
        { debug: "yes" },
        { debug: { type: "boolean" } },
      );
      expect(errors).toHaveLength(1);
    });

    it("should validate type mismatch - object", () => {
      const errors = validateConfig(
        { db: "not-object" },
        { db: { type: "object" } },
      );
      expect(errors).toHaveLength(1);
    });

    it("should validate type mismatch - array", () => {
      const errors = validateConfig(
        { items: "not-array" },
        { items: { type: "array" } },
      );
      expect(errors).toHaveLength(1);
    });

    it("should validate nested objects", () => {
      const errors = validateConfig(
        { db: { port: "abc" } },
        {
          db: {
            type: "object",
            properties: {
              port: { type: "number" },
            },
          },
        },
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("db.port");
    });

    it("should pass for valid config", () => {
      const errors = validateConfig(
        { port: 3000, host: "localhost" },
        {
          port: { type: "number", required: true },
          host: { type: "string", required: true },
        },
      );
      expect(errors).toHaveLength(0);
    });

    it("should skip optional missing fields", () => {
      const errors = validateConfig(
        {},
        { optional: { type: "string" } },
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("assertConfigValid", () => {
    it("should throw ConfigValidationError for invalid config", () => {
      expect(() =>
        assertConfigValid({}, { name: { type: "string", required: true } }),
      ).toThrow(ConfigValidationError);
    });

    it("should not throw for valid config", () => {
      expect(() =>
        assertConfigValid(
          { name: "test" },
          { name: { type: "string", required: true } },
        ),
      ).not.toThrow();
    });
  });
});

describe("EnvLoader", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("should load environment variables with prefix", () => {
    process.env["NEXUS_PORT"] = "3000";
    process.env["NEXUS_HOST"] = "localhost";

    const loader = new EnvLoader({ prefix: "NEXUS_" });
    const config = loader.load();

    expect(config.port).toBe(3000);
    expect(config.host).toBe("localhost");
  });

  it("should coerce boolean values", () => {
    process.env["NEXUS_DEBUG"] = "true";
    process.env["NEXUS_VERBOSE"] = "false";

    const loader = new EnvLoader({ prefix: "NEXUS_" });
    const config = loader.load();

    expect(config.debug).toBe(true);
    expect(config.verbose).toBe(false);
  });

  it("should coerce numeric values", () => {
    process.env["NEXUS_PORT"] = "8080";
    process.env["NEXUS_TIMEOUT"] = "30.5";

    const loader = new EnvLoader({ prefix: "NEXUS_" });
    const config = loader.load();

    expect(config.port).toBe(8080);
    expect(config.timeout).toBe(30.5);
  });

  it("should expand variable references", () => {
    process.env["BASE_URL"] = "http://localhost";
    process.env["NEXUS_API_URL"] = "${BASE_URL}/api";

    const loader = new EnvLoader({ prefix: "NEXUS_" });
    const config = loader.load();

    expect((config.api as Record<string, unknown>).url).toBe("http://localhost/api");
  });

  it("should convert underscores to nested dot-notation", () => {
    process.env["NEXUS_DATABASE_HOST"] = "dbhost";
    process.env["NEXUS_DATABASE_PORT"] = "5432";

    const loader = new EnvLoader({ prefix: "NEXUS_" });
    const config = loader.load();

    expect((config.database as Record<string, unknown>).host).toBe("dbhost");
    expect((config.database as Record<string, unknown>).port).toBe(5432);
  });
});

describe("FileLoader", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-config-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load a JSON config file", () => {
    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ port: 3000, host: "localhost" }),
    );

    const loader = new FileLoader({ filePath: configPath });
    const config = loader.load();

    expect(config.port).toBe(3000);
    expect(config.host).toBe("localhost");
  });

  it("should return empty object for missing optional file", () => {
    const loader = new FileLoader({
      filePath: path.join(tmpDir, "missing.json"),
    });
    const config = loader.load();
    expect(config).toEqual({});
  });

  it("should throw for missing required file", () => {
    const loader = new FileLoader({
      filePath: path.join(tmpDir, "missing.json"),
      required: true,
    });
    expect(() => loader.load()).toThrow("not found");
  });

  it("should load environment-specific config", () => {
    const basePath = path.join(tmpDir, "config.json");
    const devPath = path.join(tmpDir, "config.development.json");

    fs.writeFileSync(
      basePath,
      JSON.stringify({ port: 3000, debug: false }),
    );
    fs.writeFileSync(
      devPath,
      JSON.stringify({ debug: true }),
    );

    const loader = new FileLoader({
      filePath: basePath,
      environment: "development",
    });
    const config = loader.load();

    expect(config.port).toBe(3000); // From base
    expect(config.debug).toBe(true); // From dev override
  });

  it("should throw on invalid JSON", () => {
    const configPath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(configPath, "not valid json {{{");

    const loader = new FileLoader({ filePath: configPath });
    expect(() => loader.load()).toThrow("Failed to parse");
  });
});

describe("parseEnvContent", () => {
  it("should parse simple key-value pairs", () => {
    const result = parseEnvContent("KEY=value\nOTHER=123");
    expect(result).toEqual({ KEY: "value", OTHER: "123" });
  });

  it("should skip empty lines and comments", () => {
    const result = parseEnvContent("# comment\n\nKEY=value\n");
    expect(result).toEqual({ KEY: "value" });
  });

  it("should handle quoted values", () => {
    const result = parseEnvContent('KEY="hello world"\nKEY2=\'single\'');
    expect(result).toEqual({ KEY: "hello world", KEY2: "single" });
  });

  it("should handle values with equals signs", () => {
    const result = parseEnvContent("URL=http://host?a=1&b=2");
    expect(result).toEqual({ URL: "http://host?a=1&b=2" });
  });
});

describe("ConfigModule", () => {
  it("should create a forRoot dynamic module", () => {
    const mod = ConfigModule.forRoot({ global: true });
    expect(mod.module).toBe(ConfigModule);
    expect(mod.global).toBe(true);
    expect(mod.providers).toBeDefined();
    expect(mod.exports).toContain("ConfigService");
  });

  it("should create a forFeature dynamic module", () => {
    const mod = ConfigModule.forFeature({
      namespace: "database",
      schema: { host: { type: "string", required: true } },
    });
    expect(mod.module).toBe(ConfigModule);
    expect(mod.exports).toContain("CONFIG_DATABASE");
  });

  it("should default global to false", () => {
    const mod = ConfigModule.forRoot();
    expect(mod.global).toBe(false);
  });
});
