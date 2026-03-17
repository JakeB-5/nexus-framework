import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  Logger,
  NexusLogger,
  LogLevel,
  LoggerModule,
  JsonFormatter,
  PrettyFormatter,
  MinimalFormatter,
  ConsoleTransport,
  FileTransport,
  BaseTransport,
  LOG_LEVEL_NAMES,
  LOG_LEVEL_LABELS,
  type LogEntry,
  type Transport,
} from "../src/index.js";

// ─── Test Transport ───────────────────────────────────────────────────────

class TestTransport implements Transport {
  readonly name = "test";
  readonly entries: Array<{ entry: LogEntry; formatted: string }> = [];

  write(entry: LogEntry, formatted: string): void {
    this.entries.push({ entry, formatted });
  }

  clear(): void {
    this.entries.length = 0;
  }
}

// ─── Logger Tests ─────────────────────────────────────────────────────────

describe("Logger", () => {
  let transport: TestTransport;
  let logger: Logger;

  beforeEach(() => {
    transport = new TestTransport();
    logger = new Logger({
      level: LogLevel.Trace,
      transports: [transport],
    });
  });

  describe("log levels", () => {
    it("should log trace messages", () => {
      logger.trace("trace msg");
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].entry.level).toBe(LogLevel.Trace);
    });

    it("should log debug messages", () => {
      logger.debug("debug msg");
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].entry.level).toBe(LogLevel.Debug);
    });

    it("should log info messages", () => {
      logger.info("info msg");
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].entry.level).toBe(LogLevel.Info);
    });

    it("should log warn messages", () => {
      logger.warn("warn msg");
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].entry.level).toBe(LogLevel.Warn);
    });

    it("should log error messages", () => {
      logger.error("error msg");
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].entry.level).toBe(LogLevel.Error);
    });

    it("should log fatal messages", () => {
      logger.fatal("fatal msg");
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].entry.level).toBe(LogLevel.Fatal);
    });
  });

  describe("level filtering", () => {
    it("should filter messages below the configured level", () => {
      const warnLogger = new Logger({
        level: LogLevel.Warn,
        transports: [transport],
      });

      warnLogger.trace("hidden");
      warnLogger.debug("hidden");
      warnLogger.info("hidden");
      warnLogger.warn("shown");
      warnLogger.error("shown");

      expect(transport.entries).toHaveLength(2);
    });

    it("should check if level is enabled", () => {
      const infoLogger = new Logger({ level: LogLevel.Info });
      expect(infoLogger.isLevelEnabled(LogLevel.Trace)).toBe(false);
      expect(infoLogger.isLevelEnabled(LogLevel.Debug)).toBe(false);
      expect(infoLogger.isLevelEnabled(LogLevel.Info)).toBe(true);
      expect(infoLogger.isLevelEnabled(LogLevel.Error)).toBe(true);
    });

    it("should log nothing at Silent level", () => {
      const silentLogger = new Logger({
        level: LogLevel.Silent,
        transports: [transport],
      });
      silentLogger.fatal("should not appear");
      expect(transport.entries).toHaveLength(0);
    });
  });

  describe("structured data", () => {
    it("should include extra data in log entry", () => {
      logger.info("user created", { userId: 123, role: "admin" });
      expect(transport.entries[0].entry.data).toEqual({
        userId: 123,
        role: "admin",
      });
    });

    it("should include error objects", () => {
      const err = new Error("something broke");
      logger.error("failure", err);
      expect(transport.entries[0].entry.error).toBe(err);
    });

    it("should include error in fatal", () => {
      const err = new Error("critical");
      logger.fatal("crash", err);
      expect(transport.entries[0].entry.error).toBe(err);
    });

    it("should include timestamp", () => {
      logger.info("test");
      expect(transport.entries[0].entry.timestamp).toBeInstanceOf(Date);
    });

    it("should include level label", () => {
      logger.info("test");
      expect(transport.entries[0].entry.levelLabel).toBe("INFO");
    });
  });

  describe("context", () => {
    it("should include context in log entry", () => {
      const ctxLogger = new Logger({
        level: LogLevel.Trace,
        context: "UserService",
        transports: [transport],
      });

      ctxLogger.info("hello");
      expect(transport.entries[0].entry.context).toBe("UserService");
    });

    it("should return context via getter", () => {
      const ctxLogger = new Logger({ context: "MyCtx" });
      expect(ctxLogger.getContext()).toBe("MyCtx");
    });

    it("should return undefined context when not set", () => {
      expect(logger.getContext()).toBeUndefined();
    });
  });

  describe("default metadata", () => {
    it("should merge default meta into every entry", () => {
      const metaLogger = new Logger({
        level: LogLevel.Trace,
        defaultMeta: { service: "api", version: "1.0" },
        transports: [transport],
      });

      metaLogger.info("test");
      expect(transport.entries[0].entry.data).toEqual({
        service: "api",
        version: "1.0",
      });
    });

    it("should merge call-site data with default meta", () => {
      const metaLogger = new Logger({
        level: LogLevel.Trace,
        defaultMeta: { service: "api" },
        transports: [transport],
      });

      metaLogger.info("test", { requestId: "abc" });
      expect(transport.entries[0].entry.data).toEqual({
        service: "api",
        requestId: "abc",
      });
    });
  });

  describe("child loggers", () => {
    it("should create child with different context", () => {
      const child = logger.child({ context: "ChildCtx" });
      child.info("from child");

      expect(transport.entries[0].entry.context).toBe("ChildCtx");
    });

    it("should inherit parent transports", () => {
      const child = logger.child({ context: "Child" });
      child.info("test");

      expect(transport.entries).toHaveLength(1);
    });

    it("should merge child meta with parent meta", () => {
      const parent = new Logger({
        level: LogLevel.Trace,
        defaultMeta: { service: "api" },
        transports: [transport],
      });

      const child = parent.child({ meta: { module: "auth" } });
      child.info("test");

      expect(transport.entries[0].entry.data).toEqual({
        service: "api",
        module: "auth",
      });
    });
  });

  describe("message formatting", () => {
    it("should interpolate {key} placeholders", () => {
      logger.info("User {name} logged in", { name: "Alice" });
      expect(transport.entries[0].entry.message).toBe("User Alice logged in");
    });

    it("should leave unmatched placeholders", () => {
      logger.info("Hello {unknown}", { other: "val" });
      expect(transport.entries[0].entry.message).toBe("Hello {unknown}");
    });
  });

  describe("getLevel", () => {
    it("should return configured level", () => {
      expect(logger.getLevel()).toBe(LogLevel.Trace);
    });
  });

  describe("flush and close", () => {
    it("should flush transports", async () => {
      let flushed = false;
      const flushTransport: Transport = {
        name: "flush-test",
        write() {},
        flush() { flushed = true; },
      };

      const l = new Logger({ transports: [flushTransport] });
      await l.flush();
      expect(flushed).toBe(true);
    });

    it("should close transports", async () => {
      let closed = false;
      const closeTransport: Transport = {
        name: "close-test",
        write() {},
        close() { closed = true; },
      };

      const l = new Logger({ transports: [closeTransport] });
      await l.close();
      expect(closed).toBe(true);
    });
  });
});

// ─── Formatter Tests ──────────────────────────────────────────────────────

describe("Formatters", () => {
  const baseEntry: LogEntry = {
    level: LogLevel.Info,
    levelLabel: "INFO",
    message: "test message",
    timestamp: new Date("2024-01-01T12:00:00Z"),
    context: "TestCtx",
    data: { key: "value" },
  };

  describe("JsonFormatter", () => {
    it("should output valid JSON", () => {
      const formatter = new JsonFormatter();
      const result = formatter.format(baseEntry);
      const parsed = JSON.parse(result);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("test message");
      expect(parsed.context).toBe("TestCtx");
      expect(parsed.data.key).toBe("value");
    });

    it("should include error info", () => {
      const formatter = new JsonFormatter();
      const entry = { ...baseEntry, error: new Error("boom") };
      const result = JSON.parse(formatter.format(entry));
      expect(result.error.name).toBe("Error");
      expect(result.error.message).toBe("boom");
    });

    it("should omit empty data", () => {
      const formatter = new JsonFormatter();
      const entry = { ...baseEntry, data: {} };
      const result = JSON.parse(formatter.format(entry));
      expect(result.data).toBeUndefined();
    });
  });

  describe("PrettyFormatter", () => {
    it("should include time, level, context, and message", () => {
      const formatter = new PrettyFormatter({ colors: false });
      const result = formatter.format(baseEntry);
      expect(result).toContain("INFO");
      expect(result).toContain("[TestCtx]");
      expect(result).toContain("test message");
    });

    it("should include data as JSON", () => {
      const formatter = new PrettyFormatter({ colors: false });
      const result = formatter.format(baseEntry);
      expect(result).toContain('"key":"value"');
    });

    it("should include error stack", () => {
      const formatter = new PrettyFormatter({ colors: false });
      const entry = { ...baseEntry, error: new Error("oops") };
      const result = formatter.format(entry);
      expect(result).toContain("oops");
    });
  });

  describe("MinimalFormatter", () => {
    it("should output level and message", () => {
      const formatter = new MinimalFormatter();
      const result = formatter.format(baseEntry);
      expect(result).toBe("INFO [TestCtx] test message");
    });

    it("should omit context when not set", () => {
      const formatter = new MinimalFormatter();
      const entry = { ...baseEntry, context: undefined };
      const result = formatter.format(entry);
      expect(result).toBe("INFO test message");
    });
  });
});

// ─── NexusLogger Tests ───────────────────────────────────────────────────

describe("NexusLogger", () => {
  let transport: TestTransport;
  let nexusLogger: NexusLogger;

  beforeEach(() => {
    transport = new TestTransport();
    nexusLogger = new NexusLogger({
      level: LogLevel.Trace,
      transports: [transport],
    });
  });

  it("should log via convenience methods", () => {
    nexusLogger.trace("t");
    nexusLogger.debug("d");
    nexusLogger.info("i");
    nexusLogger.warn("w");
    nexusLogger.error("e");
    nexusLogger.fatal("f");
    expect(transport.entries).toHaveLength(6);
  });

  it("should create contextual loggers", () => {
    const userLogger = nexusLogger.forContext("UserService");
    userLogger.info("hello");
    expect(transport.entries[0].entry.context).toBe("UserService");
  });

  it("should cache contextual loggers", () => {
    const a = nexusLogger.forContext("Svc");
    const b = nexusLogger.forContext("Svc");
    expect(a).toBe(b);
  });

  it("should return root logger", () => {
    expect(nexusLogger.getRoot()).toBeInstanceOf(Logger);
  });

  it("should handle error objects", () => {
    const err = new Error("test");
    nexusLogger.error("fail", err);
    expect(transport.entries[0].entry.error).toBe(err);
  });

  it("should flush and close", async () => {
    await nexusLogger.flush();
    await nexusLogger.close();
    // No errors = success
  });
});

// ─── ConsoleTransport Tests ──────────────────────────────────────────────

describe("ConsoleTransport", () => {
  it("should write info to stdout", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const transport = new ConsoleTransport();
    const entry: LogEntry = {
      level: LogLevel.Info,
      levelLabel: "INFO",
      message: "test",
      timestamp: new Date(),
    };
    transport.write(entry, "formatted info");
    expect(writeSpy).toHaveBeenCalledWith("formatted info\n");
    writeSpy.mockRestore();
  });

  it("should write error to stderr", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const transport = new ConsoleTransport();
    const entry: LogEntry = {
      level: LogLevel.Error,
      levelLabel: "ERROR",
      message: "err",
      timestamp: new Date(),
    };
    transport.write(entry, "formatted error");
    expect(writeSpy).toHaveBeenCalledWith("formatted error\n");
    writeSpy.mockRestore();
  });
});

// ─── FileTransport Tests ─────────────────────────────────────────────────

describe("FileTransport", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-logger-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should write to a file", () => {
    const filePath = path.join(tmpDir, "test.log");
    const transport = new FileTransport({ filePath });
    const entry: LogEntry = {
      level: LogLevel.Info,
      levelLabel: "INFO",
      message: "hello",
      timestamp: new Date(),
    };
    transport.write(entry, "line1");
    transport.write(entry, "line2");
    transport.flush();
    transport.close();

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("line1");
    expect(content).toContain("line2");
  });

  it("should rotate files when max size exceeded", () => {
    const filePath = path.join(tmpDir, "rotate.log");
    const transport = new FileTransport({
      filePath,
      maxSize: 50, // Very small to trigger rotation
      maxFiles: 3,
    });

    const entry: LogEntry = {
      level: LogLevel.Info,
      levelLabel: "INFO",
      message: "test",
      timestamp: new Date(),
    };

    // Write enough to trigger rotation
    for (let i = 0; i < 10; i++) {
      transport.write(entry, `line ${i} with some padding data`);
    }
    transport.close();

    // Check that rotated files exist
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.existsSync(`${filePath}.1`)).toBe(true);
  });

  it("should create directory if it doesn't exist", () => {
    const filePath = path.join(tmpDir, "subdir", "nested", "test.log");
    const transport = new FileTransport({ filePath });
    const entry: LogEntry = {
      level: LogLevel.Info,
      levelLabel: "INFO",
      message: "test",
      timestamp: new Date(),
    };
    transport.write(entry, "test");
    transport.close();

    expect(fs.existsSync(filePath)).toBe(true);
  });
});

// ─── BaseTransport Tests ─────────────────────────────────────────────────

describe("BaseTransport", () => {
  it("should filter by minimum level", () => {
    const entries: string[] = [];

    class CustomTransport extends BaseTransport {
      readonly name = "custom";
      protected writeEntry(_entry: LogEntry, formatted: string): void {
        entries.push(formatted);
      }
    }

    const transport = new CustomTransport({ level: LogLevel.Warn });
    const infoEntry: LogEntry = {
      level: LogLevel.Info,
      levelLabel: "INFO",
      message: "hidden",
      timestamp: new Date(),
    };
    const warnEntry: LogEntry = {
      level: LogLevel.Warn,
      levelLabel: "WARN",
      message: "shown",
      timestamp: new Date(),
    };

    transport.write(infoEntry, "info-line");
    transport.write(warnEntry, "warn-line");

    expect(entries).toEqual(["warn-line"]);
  });
});

// ─── Constants Tests ─────────────────────────────────────────────────────

describe("Constants", () => {
  it("should have correct level names", () => {
    expect(LOG_LEVEL_NAMES.trace).toBe(LogLevel.Trace);
    expect(LOG_LEVEL_NAMES.info).toBe(LogLevel.Info);
    expect(LOG_LEVEL_NAMES.error).toBe(LogLevel.Error);
  });

  it("should have correct level labels", () => {
    expect(LOG_LEVEL_LABELS[LogLevel.Info]).toBe("INFO");
    expect(LOG_LEVEL_LABELS[LogLevel.Error]).toBe("ERROR");
    expect(LOG_LEVEL_LABELS[LogLevel.Fatal]).toBe("FATAL");
  });
});

// ─── LoggerModule Tests ──────────────────────────────────────────────────

describe("LoggerModule", () => {
  it("should create a forRoot dynamic module", () => {
    const mod = LoggerModule.forRoot({ global: true });
    expect(mod.module).toBe(LoggerModule);
    expect(mod.global).toBe(true);
    expect(mod.exports).toContain("NexusLogger");
  });

  it("should default to global true", () => {
    const mod = LoggerModule.forRoot();
    expect(mod.global).toBe(true);
  });

  it("should accept custom log level", () => {
    const mod = LoggerModule.forRoot({ level: LogLevel.Debug });
    expect(mod.providers).toBeDefined();
  });
});
