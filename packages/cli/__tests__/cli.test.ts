// @nexus/cli - Comprehensive tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseArgs,
  formatHelp,
  formatCommandHelp,
  CommandRegistry,
  CliApp,
  TemplateEngine,
  templateFile,
  getBuiltinTemplates,
  ConsoleLogger,
  SilentLogger,
  UnknownCommandError,
  MissingArgumentError,
  CliError,
  TemplateError,
} from "../src/index.js";
import type {
  CommandDefinition,
  CommandContext,
  ParsedArgs,
  CliLogger,
} from "../src/index.js";

// ─── parseArgs ──────────────────────────────────────────

describe("parseArgs", () => {
  it("should parse a command name", () => {
    const result = parseArgs(["build"]);
    expect(result.command).toBe("build");
    expect(result.positionals).toEqual([]);
    expect(result.options).toEqual({});
  });

  it("should parse command with positional arguments", () => {
    const result = parseArgs(["generate", "module", "user"]);
    expect(result.command).toBe("generate");
    expect(result.positionals).toEqual(["module", "user"]);
  });

  it("should parse long option with = separator", () => {
    const result = parseArgs(["build", "--output=dist"]);
    expect(result.command).toBe("build");
    expect(result.options["output"]).toBe("dist");
  });

  it("should parse long option with space separator", () => {
    const result = parseArgs(["build", "--output", "dist"]);
    expect(result.options["output"]).toBe("dist");
  });

  it("should parse boolean flags", () => {
    const result = parseArgs(["build", "--verbose", "--force"]);
    expect(result.options["verbose"]).toBe(true);
    expect(result.options["force"]).toBe(true);
  });

  it("should parse short options with value", () => {
    const result = parseArgs(["build", "-o", "dist"]);
    expect(result.options["o"]).toBe("dist");
  });

  it("should parse short boolean flags", () => {
    const result = parseArgs(["build", "-v"]);
    expect(result.options["v"]).toBe(true);
  });

  it("should parse combined short flags", () => {
    const result = parseArgs(["build", "-abc"]);
    expect(result.options["a"]).toBe(true);
    expect(result.options["b"]).toBe(true);
    expect(result.options["c"]).toBe(true);
  });

  it("should handle --no-flag negation", () => {
    const result = parseArgs(["build", "--no-color"]);
    expect(result.options["color"]).toBe(false);
  });

  it("should stop option parsing after --", () => {
    const result = parseArgs(["run", "--", "--not-an-option", "foo"]);
    expect(result.command).toBe("run");
    expect(result.positionals).toEqual(["--not-an-option", "foo"]);
    expect(result.options).toEqual({});
  });

  it("should return empty command for empty argv", () => {
    const result = parseArgs([]);
    expect(result.command).toBe("");
    expect(result.positionals).toEqual([]);
    expect(result.options).toEqual({});
  });

  it("should parse options before command", () => {
    const result = parseArgs(["--version"]);
    expect(result.options["version"]).toBe(true);
    expect(result.command).toBe("");
  });

  it("should handle mixed options and positionals", () => {
    const result = parseArgs(["gen", "module", "--name", "user", "extra"]);
    expect(result.command).toBe("gen");
    expect(result.options["name"]).toBe("user");
    expect(result.positionals).toContain("module");
    expect(result.positionals).toContain("extra");
  });

  it("should treat next arg starting with - as boolean flag boundary", () => {
    const result = parseArgs(["cmd", "--flag", "--other"]);
    expect(result.options["flag"]).toBe(true);
    expect(result.options["other"]).toBe(true);
  });
});

// ─── formatHelp ─────────────────────────────────────────

describe("formatHelp", () => {
  it("should format help with name, version, and commands", () => {
    const output = formatHelp(
      "nexus",
      "A framework CLI",
      [
        { name: "build", description: "Build the project" },
        { name: "generate", description: "Generate code" },
      ],
      "1.0.0",
    );
    expect(output).toContain("nexus v1.0.0");
    expect(output).toContain("A framework CLI");
    expect(output).toContain("build");
    expect(output).toContain("generate");
    expect(output).toContain("Commands:");
    expect(output).toContain("--help, -h");
    expect(output).toContain("--version, -v");
  });

  it("should pad command names for alignment", () => {
    const output = formatHelp(
      "cli",
      "",
      [
        { name: "a", description: "Short" },
        { name: "longcmd", description: "Long" },
      ],
      "1.0.0",
    );
    // Both entries should exist with proper spacing
    expect(output).toContain("a");
    expect(output).toContain("longcmd");
  });
});

// ─── formatCommandHelp ──────────────────────────────────

describe("formatCommandHelp", () => {
  it("should format command help with description", () => {
    const output = formatCommandHelp("nexus", {
      name: "build",
      description: "Build the project",
    });
    expect(output).toContain("Build the project");
    expect(output).toContain("nexus build");
  });

  it("should show required and optional arguments", () => {
    const output = formatCommandHelp("nexus", {
      name: "generate",
      description: "Generate code",
      args: [
        { name: "type", description: "Template type", required: true },
        { name: "name", description: "Output name", required: false },
      ],
    });
    expect(output).toContain("<type>");
    expect(output).toContain("[name]");
    expect(output).toContain("(required)");
    expect(output).toContain("Arguments:");
  });

  it("should show options with aliases and defaults", () => {
    const output = formatCommandHelp("nexus", {
      name: "build",
      description: "Build",
      options: [
        {
          name: "output",
          description: "Output dir",
          alias: "o",
          default: "./dist",
        },
        { name: "verbose", description: "Verbose output" },
      ],
    });
    expect(output).toContain("--output, -o");
    expect(output).toContain("(default: ./dist)");
    expect(output).toContain("--verbose");
    expect(output).toContain("Options:");
  });

  it("should show extra help text if provided", () => {
    const output = formatCommandHelp("nexus", {
      name: "init",
      description: "Initialize project",
      help: "Creates a new project structure with all needed files.",
    });
    expect(output).toContain(
      "Creates a new project structure with all needed files.",
    );
  });
});

// ─── CommandRegistry ────────────────────────────────────

describe("CommandRegistry", () => {
  let registry: CommandRegistry;
  const noop = () => {};

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it("should register and resolve a command", () => {
    registry.register({ name: "build", description: "Build", handler: noop });
    const cmd = registry.resolve("build");
    expect(cmd.name).toBe("build");
  });

  it("should resolve by alias", () => {
    registry.register({
      name: "generate",
      description: "Gen",
      aliases: ["g", "gen"],
      handler: noop,
    });
    expect(registry.resolve("g").name).toBe("generate");
    expect(registry.resolve("gen").name).toBe("generate");
  });

  it("should throw UnknownCommandError for missing command", () => {
    expect(() => registry.resolve("nope")).toThrow(UnknownCommandError);
  });

  it("should check if a command exists by name", () => {
    registry.register({ name: "test", description: "Test", handler: noop });
    expect(registry.has("test")).toBe(true);
    expect(registry.has("nope")).toBe(false);
  });

  it("should check if a command exists by alias", () => {
    registry.register({
      name: "test",
      description: "Test",
      aliases: ["t"],
      handler: noop,
    });
    expect(registry.has("t")).toBe(true);
  });

  it("should list all commands", () => {
    registry.register({ name: "a", description: "A", handler: noop });
    registry.register({ name: "b", description: "B", handler: noop });
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.name)).toContain("a");
    expect(all.map((c) => c.name)).toContain("b");
  });

  it("should list command names", () => {
    registry.register({ name: "foo", description: "Foo", handler: noop });
    expect(registry.getNames()).toEqual(["foo"]);
  });

  it("should report size", () => {
    expect(registry.size).toBe(0);
    registry.register({ name: "x", description: "X", handler: noop });
    expect(registry.size).toBe(1);
  });

  it("should add a command with shorthand", () => {
    registry.add("lint", "Run linter", noop);
    expect(registry.has("lint")).toBe(true);
  });

  it("should remove a command and its aliases", () => {
    registry.register({
      name: "deploy",
      description: "Deploy",
      aliases: ["d"],
      handler: noop,
    });
    expect(registry.remove("deploy")).toBe(true);
    expect(registry.has("deploy")).toBe(false);
    expect(registry.has("d")).toBe(false);
  });

  it("should return false when removing non-existent command", () => {
    expect(registry.remove("ghost")).toBe(false);
  });

  it("should clear all commands", () => {
    registry.register({ name: "a", description: "A", handler: noop });
    registry.register({ name: "b", description: "B", handler: noop });
    registry.clear();
    expect(registry.size).toBe(0);
  });
});

// ─── TemplateEngine ─────────────────────────────────────

describe("TemplateEngine", () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  it("should register and retrieve a template", () => {
    engine.register({
      name: "test",
      files: [{ path: "test.ts", content: "hello" }],
    });
    const tmpl = engine.get("test");
    expect(tmpl).toBeDefined();
    expect(tmpl!.name).toBe("test");
  });

  it("should return undefined for unknown template", () => {
    expect(engine.get("nope")).toBeUndefined();
  });

  it("should list template names", () => {
    engine.register({ name: "a", files: [] });
    engine.register({ name: "b", files: [] });
    expect(engine.getNames()).toEqual(["a", "b"]);
  });

  it("should interpolate {{variable}} placeholders", () => {
    const result = engine.interpolate(
      "Hello {{name}}, welcome to {{project}}!",
      { name: "Alice", project: "Nexus" },
    );
    expect(result).toBe("Hello Alice, welcome to Nexus!");
  });

  it("should leave unknown variables as-is", () => {
    const result = engine.interpolate("{{known}} and {{unknown}}", {
      known: "yes",
    });
    expect(result).toBe("yes and {{unknown}}");
  });

  it("should preview generated files without writing", () => {
    engine.register({
      name: "component",
      files: [
        { path: "src/{{name}}.ts", content: "export class {{Name}} {}" },
      ],
    });
    const files = engine.preview("component", {
      name: "user",
      Name: "User",
    });
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/user.ts");
    expect(files[0].content).toBe("export class User {}");
  });

  it("should throw TemplateError when previewing unknown template", () => {
    expect(() => engine.preview("ghost", {})).toThrow(TemplateError);
  });

  it("should throw TemplateError when generating unknown template", () => {
    expect(() => engine.generate("ghost", {}, "/tmp")).toThrow(TemplateError);
  });

  it("should support chaining on register", () => {
    const result = engine
      .register({ name: "a", files: [] })
      .register({ name: "b", files: [] });
    expect(result).toBe(engine);
    expect(engine.getNames()).toEqual(["a", "b"]);
  });
});

// ─── templateFile helper ────────────────────────────────

describe("templateFile", () => {
  it("should create a TemplateFile object", () => {
    const file = templateFile("src/index.ts", "export {}");
    expect(file.path).toBe("src/index.ts");
    expect(file.content).toBe("export {}");
  });
});

// ─── getBuiltinTemplates ────────────────────────────────

describe("getBuiltinTemplates", () => {
  it("should return module and service templates", () => {
    const templates = getBuiltinTemplates();
    const names = templates.map((t) => t.name);
    expect(names).toContain("module");
    expect(names).toContain("service");
  });

  it("should have files in module template", () => {
    const templates = getBuiltinTemplates();
    const moduleTemplate = templates.find((t) => t.name === "module")!;
    expect(moduleTemplate.files.length).toBeGreaterThanOrEqual(2);
  });

  it("should have interpolation placeholders in templates", () => {
    const templates = getBuiltinTemplates();
    const moduleTemplate = templates.find((t) => t.name === "module")!;
    const paths = moduleTemplate.files.map((f) => f.path);
    expect(paths.some((p) => p.includes("{{name}}"))).toBe(true);
  });
});

// ─── ConsoleLogger ──────────────────────────────────────

describe("ConsoleLogger", () => {
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger({ colors: false });
  });

  it("should write info to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.info("test message");
    expect(spy).toHaveBeenCalledWith("info  test message\n");
    spy.mockRestore();
  });

  it("should write success to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.success("done!");
    expect(spy).toHaveBeenCalledWith("done  done!\n");
    spy.mockRestore();
  });

  it("should write warn to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.warn("careful");
    expect(spy).toHaveBeenCalledWith("warn  careful\n");
    spy.mockRestore();
  });

  it("should write error to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.error("fail");
    expect(spy).toHaveBeenCalledWith("error fail\n");
    spy.mockRestore();
  });

  it("should write debug to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.debug("trace");
    expect(spy).toHaveBeenCalledWith("debug trace\n");
    spy.mockRestore();
  });

  it("should support colored output", () => {
    const colorLogger = new ConsoleLogger({ colors: true });
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    colorLogger.info("colored");
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain("colored");
    // Should contain ANSI escape codes
    expect(output).toContain("\x1b[");
    spy.mockRestore();
  });
});

// ─── SilentLogger ───────────────────────────────────────

describe("SilentLogger", () => {
  it("should not throw on any log level", () => {
    const logger = new SilentLogger();
    expect(() => logger.info("x")).not.toThrow();
    expect(() => logger.success("x")).not.toThrow();
    expect(() => logger.warn("x")).not.toThrow();
    expect(() => logger.error("x")).not.toThrow();
    expect(() => logger.debug("x")).not.toThrow();
  });

  it("should not write to stdout or stderr", () => {
    const logger = new SilentLogger();
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.info("x");
    logger.error("x");
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

// ─── Error classes ──────────────────────────────────────

describe("Error classes", () => {
  it("CliError should have name and message", () => {
    const err = new CliError("oops");
    expect(err.name).toBe("CliError");
    expect(err.message).toBe("oops");
    expect(err instanceof Error).toBe(true);
  });

  it("UnknownCommandError should include command name", () => {
    const err = new UnknownCommandError("xyz");
    expect(err.message).toContain("xyz");
    expect(err.name).toBe("UnknownCommandError");
    expect(err instanceof Error).toBe(true);
    expect((err as UnknownCommandError).commandName).toBe("xyz");
  });

  it("MissingArgumentError should include arg and command", () => {
    const err = new MissingArgumentError("name", "generate");
    expect(err.message).toContain("name");
    expect(err.message).toContain("generate");
    expect(err instanceof Error).toBe(true);
    expect((err as MissingArgumentError).argName).toBe("name");
  });

  it("TemplateError should be an Error", () => {
    const err = new TemplateError("bad template");
    expect(err.name).toBe("TemplateError");
    expect(err instanceof Error).toBe(true);
    expect(err.message).toBe("bad template");
  });
});

// ─── CliApp ─────────────────────────────────────────────

describe("CliApp", () => {
  let app: CliApp;
  let output: string[];

  beforeEach(() => {
    app = new CliApp({
      name: "nexus",
      version: "1.0.0",
      description: "A test CLI",
    });
    output = [];
    // Capture stdout to avoid test noise
    vi.spyOn(process.stdout, "write").mockImplementation((str) => {
      output.push(String(str));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((str) => {
      output.push(String(str));
      return true;
    });
  });

  it("should show version with --version", async () => {
    await app.run(["--version"]);
    expect(output.join("")).toContain("nexus v1.0.0");
  });

  it("should show version with -v flag", async () => {
    await app.run(["-v"]);
    expect(output.join("")).toContain("nexus v1.0.0");
  });

  it("should show help with no arguments", async () => {
    await app.run([]);
    const text = output.join("");
    expect(text).toContain("nexus");
    expect(text).toContain("Commands:");
  });

  it("should show help with --help", async () => {
    await app.run(["--help"]);
    const text = output.join("");
    expect(text).toContain("Commands:");
  });

  it("should register and execute a custom command", async () => {
    let executed = false;
    app.command({
      name: "greet",
      description: "Say hello",
      handler: (ctx) => {
        executed = true;
        ctx.logger.info("Hello!");
      },
    });
    await app.run(["greet"]);
    expect(executed).toBe(true);
    expect(output.join("")).toContain("Hello!");
  });

  it("should pass parsed args to command handler", async () => {
    let receivedArgs: ParsedArgs | undefined;
    app.command({
      name: "test",
      description: "Test",
      handler: (ctx) => {
        receivedArgs = ctx.args;
      },
    });
    await app.run(["test", "foo", "--bar", "baz"]);
    expect(receivedArgs).toBeDefined();
    expect(receivedArgs!.positionals).toContain("foo");
    expect(receivedArgs!.options["bar"]).toBe("baz");
  });

  it("should handle unknown command gracefully", async () => {
    await app.run(["nonexistent"]);
    const text = output.join("");
    expect(text).toContain("nonexistent");
    expect(text).toContain("--help");
  });

  it("should handle async command handlers", async () => {
    let done = false;
    app.command({
      name: "async-cmd",
      description: "Async",
      handler: async () => {
        await Promise.resolve();
        done = true;
      },
    });
    await app.run(["async-cmd"]);
    expect(done).toBe(true);
  });

  it("should handle command handler errors", async () => {
    app.command({
      name: "fail",
      description: "Fails",
      handler: () => {
        throw new Error("command failed");
      },
    });
    await app.run(["fail"]);
    expect(output.join("")).toContain("command failed");
  });

  it("should support command chaining", () => {
    const result = app
      .command({ name: "a", description: "A", handler: () => {} })
      .command({ name: "b", description: "B", handler: () => {} });
    expect(result).toBe(app);
  });

  it("should have built-in help command", async () => {
    await app.run(["help"]);
    const text = output.join("");
    expect(text).toContain("Commands:");
  });

  it("should have built-in version command", async () => {
    await app.run(["version"]);
    expect(output.join("")).toContain("nexus v1.0.0");
  });

  it("should resolve version command alias 'v'", async () => {
    await app.run(["v"]);
    expect(output.join("")).toContain("nexus v1.0.0");
  });

  it("should show command-specific help via help command", async () => {
    app.command({
      name: "build",
      description: "Build the project",
      args: [{ name: "target", description: "Build target", required: true }],
      handler: () => {},
    });
    await app.run(["help", "build"]);
    const text = output.join("");
    expect(text).toContain("Build the project");
    expect(text).toContain("<target>");
  });

  it("should show error for unknown command in help", async () => {
    await app.run(["help", "ghost"]);
    expect(output.join("")).toContain("Unknown command");
  });

  it("should show command help with --help positional", async () => {
    app.command({
      name: "deploy",
      description: "Deploy app",
      handler: () => {},
    });
    await app.run(["deploy", "--help"]);
    const text = output.join("");
    expect(text).toContain("Deploy app");
  });

  it("should expose registry", () => {
    const registry = app.getRegistry();
    expect(registry).toBeInstanceOf(CommandRegistry);
    // Should have built-in commands
    expect(registry.has("help")).toBe(true);
    expect(registry.has("version")).toBe(true);
  });

  it("should expose template engine", () => {
    const engine = app.getTemplateEngine();
    expect(engine).toBeInstanceOf(TemplateEngine);
    // Should have built-in templates
    expect(engine.getNames()).toContain("module");
    expect(engine.getNames()).toContain("service");
  });

  it("should provide cwd in command context", async () => {
    let receivedCwd = "";
    app.command({
      name: "check-cwd",
      description: "Check cwd",
      handler: (ctx) => {
        receivedCwd = ctx.cwd;
      },
    });
    await app.run(["check-cwd"]);
    expect(receivedCwd).toBe(process.cwd());
  });

  it("should handle non-Error thrown values", async () => {
    app.command({
      name: "throw-string",
      description: "Throws string",
      handler: () => {
        throw "string error";
      },
    });
    await app.run(["throw-string"]);
    expect(output.join("")).toContain("string error");
  });
});
