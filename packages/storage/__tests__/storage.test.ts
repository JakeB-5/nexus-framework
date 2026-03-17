// @nexus/storage - Comprehensive tests

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  MemoryAdapter,
  LocalAdapter,
  Disk,
  StorageManager,
  StorageModule,
  StorageError,
  FileNotFoundError,
  normalizePath,
  sanitizePath,
  isPathSafe,
  getExtension,
  getFilename,
  getDirectory,
  joinPath,
  getMimeType,
} from "../src/index.js";

// ============================================================
// PATH UTILITIES
// ============================================================
describe("Path utilities", () => {
  describe("normalizePath", () => {
    it("converts backslashes to forward slashes", () => {
      expect(normalizePath("foo\\bar\\baz")).toBe("foo/bar/baz");
    });

    it("collapses double slashes", () => {
      expect(normalizePath("foo//bar///baz")).toBe("foo/bar/baz");
    });

    it("removes leading slash", () => {
      expect(normalizePath("/foo/bar")).toBe("foo/bar");
    });

    it("removes trailing slash", () => {
      expect(normalizePath("foo/bar/")).toBe("foo/bar");
    });

    it("handles empty string", () => {
      expect(normalizePath("")).toBe("");
    });
  });

  describe("sanitizePath", () => {
    it("removes .. segments", () => {
      expect(sanitizePath("foo/../bar")).toBe("bar");
    });

    it("prevents traversal above root", () => {
      expect(sanitizePath("../../etc/passwd")).toBe("etc/passwd");
    });

    it("removes . segments", () => {
      expect(sanitizePath("./foo/./bar")).toBe("foo/bar");
    });

    it("normalizes path", () => {
      expect(sanitizePath("foo//bar\\baz")).toBe("foo/bar/baz");
    });

    it("handles complex traversal", () => {
      expect(sanitizePath("a/b/../../c/d/../e")).toBe("c/e");
    });
  });

  describe("isPathSafe", () => {
    it("returns true for safe paths", () => {
      expect(isPathSafe("foo/bar/baz.txt")).toBe(true);
      expect(isPathSafe("uploads/image.png")).toBe(true);
    });

    it("returns false for traversal attempts", () => {
      expect(isPathSafe("../etc/passwd")).toBe(false);
      expect(isPathSafe("foo/../../bar")).toBe(false);
    });

    it("returns false for absolute paths", () => {
      expect(isPathSafe("/etc/passwd")).toBe(false);
    });
  });

  describe("getExtension", () => {
    it("returns extension without dot", () => {
      expect(getExtension("file.txt")).toBe("txt");
      expect(getExtension("photo.jpg")).toBe("jpg");
      expect(getExtension("path/to/file.ts")).toBe("ts");
    });

    it("returns lowercase extension", () => {
      expect(getExtension("FILE.PNG")).toBe("png");
    });

    it("returns empty for no extension", () => {
      expect(getExtension("Makefile")).toBe("");
      // .gitignore has dotIndex=0, which is < 1, so returns ""
      expect(getExtension(".gitignore")).toBe("");
    });

    it("handles multiple dots", () => {
      expect(getExtension("file.test.ts")).toBe("ts");
    });
  });

  describe("getFilename", () => {
    it("returns filename from path", () => {
      expect(getFilename("path/to/file.txt")).toBe("file.txt");
    });

    it("returns name if no directory", () => {
      expect(getFilename("file.txt")).toBe("file.txt");
    });
  });

  describe("getDirectory", () => {
    it("returns directory from path", () => {
      expect(getDirectory("path/to/file.txt")).toBe("path/to");
    });

    it("returns empty for root files", () => {
      expect(getDirectory("file.txt")).toBe("");
    });
  });

  describe("joinPath", () => {
    it("joins segments", () => {
      expect(joinPath("foo", "bar", "baz")).toBe("foo/bar/baz");
    });

    it("normalizes result", () => {
      expect(joinPath("foo/", "/bar/", "/baz")).toBe("foo/bar/baz");
    });
  });

  describe("getMimeType", () => {
    it("returns correct mime types", () => {
      expect(getMimeType("file.txt")).toBe("text/plain");
      expect(getMimeType("image.png")).toBe("image/png");
      expect(getMimeType("data.json")).toBe("application/json");
      expect(getMimeType("page.html")).toBe("text/html");
      expect(getMimeType("style.css")).toBe("text/css");
      expect(getMimeType("script.js")).toBe("application/javascript");
      expect(getMimeType("photo.jpg")).toBe("image/jpeg");
      expect(getMimeType("doc.pdf")).toBe("application/pdf");
    });

    it("returns octet-stream for unknown types", () => {
      expect(getMimeType("file.xyz")).toBe("application/octet-stream");
    });
  });
});

// ============================================================
// MEMORY ADAPTER
// ============================================================
describe("MemoryAdapter", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  it("write and read a file", async () => {
    await adapter.write("test.txt", "hello world");
    const content = await adapter.read("test.txt");
    expect(content.toString()).toBe("hello world");
  });

  it("write and read Buffer", async () => {
    const buf = Buffer.from([1, 2, 3, 4]);
    await adapter.write("binary.dat", buf);
    const content = await adapter.read("binary.dat");
    expect(content).toEqual(buf);
  });

  it("read throws FileNotFoundError for missing files", async () => {
    await expect(adapter.read("missing.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("exists returns true for existing files", async () => {
    await adapter.write("file.txt", "data");
    expect(await adapter.exists("file.txt")).toBe(true);
    expect(await adapter.exists("missing.txt")).toBe(false);
  });

  it("delete removes files", async () => {
    await adapter.write("file.txt", "data");
    expect(await adapter.delete("file.txt")).toBe(true);
    expect(await adapter.exists("file.txt")).toBe(false);
    expect(await adapter.delete("file.txt")).toBe(false);
  });

  it("copy creates a duplicate", async () => {
    await adapter.write("source.txt", "content");
    await adapter.copy("source.txt", "dest.txt");
    expect(await adapter.exists("source.txt")).toBe(true);
    expect(await adapter.exists("dest.txt")).toBe(true);
    const content = await adapter.read("dest.txt");
    expect(content.toString()).toBe("content");
  });

  it("copy throws for missing source", async () => {
    await expect(adapter.copy("missing.txt", "dest.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("move relocates a file", async () => {
    await adapter.write("old.txt", "data");
    await adapter.move("old.txt", "new.txt");
    expect(await adapter.exists("old.txt")).toBe(false);
    expect(await adapter.exists("new.txt")).toBe(true);
  });

  it("list returns all files", async () => {
    await adapter.write("a.txt", "1");
    await adapter.write("b.txt", "2");
    await adapter.write("dir/c.txt", "3");

    const all = await adapter.list();
    expect(all.length).toBe(3);
    expect(all.map((f) => f.path).sort()).toEqual(["a.txt", "b.txt", "dir/c.txt"]);
  });

  it("list filters by prefix", async () => {
    await adapter.write("uploads/a.png", "1");
    await adapter.write("uploads/b.png", "2");
    await adapter.write("docs/c.txt", "3");

    const uploads = await adapter.list("uploads");
    expect(uploads.length).toBe(2);
    expect(uploads.every((f) => f.path.startsWith("uploads/"))).toBe(true);
  });

  it("list returns file info with size", async () => {
    await adapter.write("file.txt", "hello");
    const files = await adapter.list();
    expect(files[0].size).toBe(5);
    expect(files[0].isDirectory).toBe(false);
    expect(files[0].lastModified).toBeInstanceOf(Date);
  });

  it("stat returns file statistics", async () => {
    await adapter.write("file.txt", "hello world");
    const stats = await adapter.stat("file.txt");
    expect(stats.path).toBe("file.txt");
    expect(stats.size).toBe(11);
    expect(stats.isFile).toBe(true);
    expect(stats.isDirectory).toBe(false);
    expect(stats.lastModified).toBeInstanceOf(Date);
    expect(stats.createdAt).toBeInstanceOf(Date);
  });

  it("stat throws for missing files", async () => {
    await expect(adapter.stat("missing.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("sanitizes paths to prevent traversal", async () => {
    await adapter.write("../etc/passwd", "hacked");
    // Should be stored as "etc/passwd" not "../etc/passwd"
    expect(await adapter.exists("etc/passwd")).toBe(true);
    expect(adapter.fileCount).toBe(1);
  });

  it("overwrites existing files", async () => {
    await adapter.write("file.txt", "old");
    await adapter.write("file.txt", "new");
    expect((await adapter.read("file.txt")).toString()).toBe("new");
    expect(adapter.fileCount).toBe(1);
  });

  it("clear removes all files", async () => {
    await adapter.write("a.txt", "1");
    await adapter.write("b.txt", "2");
    adapter.clear();
    expect(adapter.fileCount).toBe(0);
  });
});

// ============================================================
// LOCAL ADAPTER (with temp directory)
// ============================================================
describe("LocalAdapter", () => {
  let tmpDir: string;
  let adapter: LocalAdapter;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-storage-test-"));
    adapter = new LocalAdapter(tmpDir);
  });

  afterAll(async () => {
    // Cleanup temp dirs - best effort
    try {
      // Find and remove all test dirs
      const tmpBase = os.tmpdir();
      const entries = await fs.readdir(tmpBase);
      for (const entry of entries) {
        if (entry.startsWith("nexus-storage-test-")) {
          await fs.rm(path.join(tmpBase, entry), { recursive: true, force: true });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("write and read a file", async () => {
    await adapter.write("test.txt", "hello");
    const content = await adapter.read("test.txt");
    expect(content.toString()).toBe("hello");
  });

  it("write creates parent directories", async () => {
    await adapter.write("deep/nested/dir/file.txt", "content");
    const content = await adapter.read("deep/nested/dir/file.txt");
    expect(content.toString()).toBe("content");
  });

  it("read throws FileNotFoundError", async () => {
    await expect(adapter.read("missing.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("exists checks file existence", async () => {
    await adapter.write("file.txt", "data");
    expect(await adapter.exists("file.txt")).toBe(true);
    expect(await adapter.exists("missing.txt")).toBe(false);
  });

  it("delete removes files", async () => {
    await adapter.write("file.txt", "data");
    expect(await adapter.delete("file.txt")).toBe(true);
    expect(await adapter.exists("file.txt")).toBe(false);
  });

  it("delete returns false for missing files", async () => {
    expect(await adapter.delete("missing.txt")).toBe(false);
  });

  it("copy duplicates a file", async () => {
    await adapter.write("source.txt", "content");
    await adapter.copy("source.txt", "dest.txt");
    expect(await adapter.exists("source.txt")).toBe(true);
    expect((await adapter.read("dest.txt")).toString()).toBe("content");
  });

  it("copy creates parent dirs for target", async () => {
    await adapter.write("file.txt", "data");
    await adapter.copy("file.txt", "sub/dir/copy.txt");
    expect(await adapter.exists("sub/dir/copy.txt")).toBe(true);
  });

  it("move relocates a file", async () => {
    await adapter.write("old.txt", "data");
    await adapter.move("old.txt", "new.txt");
    expect(await adapter.exists("old.txt")).toBe(false);
    expect(await adapter.exists("new.txt")).toBe(true);
  });

  it("list returns directory contents", async () => {
    await adapter.write("a.txt", "1");
    await adapter.write("b.txt", "2");
    const files = await adapter.list();
    expect(files.length).toBe(2);
    expect(files.map((f) => f.path).sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("list returns empty for missing directory", async () => {
    const files = await adapter.list("nonexistent");
    expect(files).toEqual([]);
  });

  it("stat returns file info", async () => {
    await adapter.write("file.txt", "hello");
    const stats = await adapter.stat("file.txt");
    expect(stats.size).toBe(5);
    expect(stats.isFile).toBe(true);
    expect(stats.isDirectory).toBe(false);
    expect(stats.mimeType).toBe("text/plain");
  });

  it("stat throws for missing files", async () => {
    await expect(adapter.stat("missing.txt")).rejects.toThrow(FileNotFoundError);
  });

  it("sanitizes paths to prevent traversal", async () => {
    await adapter.write("../escape.txt", "data");
    // Should not escape the base directory
    const fullPath = path.join(tmpDir, "escape.txt");
    const stat = await fs.stat(fullPath);
    expect(stat.isFile()).toBe(true);
  });
});

// ============================================================
// DISK
// ============================================================
describe("Disk", () => {
  let adapter: MemoryAdapter;
  let disk: Disk;

  beforeEach(() => {
    adapter = new MemoryAdapter();
    disk = new Disk("test", adapter, { baseUrl: "https://cdn.example.com/files" });
  });

  it("has a name", () => {
    expect(disk.name).toBe("test");
  });

  it("read/write through adapter", async () => {
    await disk.write("file.txt", "content");
    const buf = await disk.read("file.txt");
    expect(buf.toString()).toBe("content");
  });

  it("readString returns string", async () => {
    await disk.write("file.txt", "hello");
    expect(await disk.readString("file.txt")).toBe("hello");
  });

  it("delete/exists work", async () => {
    await disk.write("file.txt", "data");
    expect(await disk.exists("file.txt")).toBe(true);
    await disk.delete("file.txt");
    expect(await disk.exists("file.txt")).toBe(false);
  });

  it("copy/move work", async () => {
    await disk.write("a.txt", "data");
    await disk.copy("a.txt", "b.txt");
    expect(await disk.exists("a.txt")).toBe(true);
    expect(await disk.exists("b.txt")).toBe(true);

    await disk.move("b.txt", "c.txt");
    expect(await disk.exists("b.txt")).toBe(false);
    expect(await disk.exists("c.txt")).toBe(true);
  });

  it("list returns files", async () => {
    await disk.write("a.txt", "1");
    await disk.write("b.txt", "2");
    const files = await disk.list();
    expect(files.length).toBe(2);
  });

  it("stat returns file info", async () => {
    await disk.write("file.txt", "hello");
    const stats = await disk.stat("file.txt");
    expect(stats.size).toBe(5);
  });

  it("url generates public URL", () => {
    expect(disk.url("images/photo.jpg")).toBe("https://cdn.example.com/files/images/photo.jpg");
  });

  it("url without baseUrl returns path", () => {
    const d = new Disk("plain", adapter);
    expect(d.url("file.txt")).toBe("file.txt");
  });

  it("temporaryUrl includes expiry", () => {
    const url = disk.temporaryUrl("file.txt", 3600);
    expect(url).toContain("https://cdn.example.com/files/file.txt");
    expect(url).toContain("expires=");
  });

  it("getAdapter returns the adapter", () => {
    expect(disk.getAdapter()).toBe(adapter);
  });
});

// ============================================================
// STORAGE MANAGER
// ============================================================
describe("StorageManager", () => {
  it("registers and retrieves disks", () => {
    const manager = new StorageManager();
    const disk = new Disk("uploads", new MemoryAdapter());
    manager.register("uploads", disk);
    expect(manager.disk("uploads")).toBe(disk);
  });

  it("throws for unknown disk", () => {
    const manager = new StorageManager();
    expect(() => manager.disk("missing")).toThrow(StorageError);
  });

  it("supports default disk", () => {
    const manager = new StorageManager();
    const disk = new Disk("default", new MemoryAdapter());
    manager.register("default", disk);
    expect(manager.disk()).toBe(disk);
  });

  it("setDefault changes default disk", () => {
    const manager = new StorageManager();
    const d1 = new Disk("a", new MemoryAdapter());
    const d2 = new Disk("b", new MemoryAdapter());
    manager.register("a", d1);
    manager.register("b", d2);
    manager.setDefault("b");
    expect(manager.disk()).toBe(d2);
  });

  it("getRegisteredDisks lists all names", () => {
    const manager = new StorageManager();
    manager.register("a", new Disk("a", new MemoryAdapter()));
    manager.register("b", new Disk("b", new MemoryAdapter()));
    expect(manager.getRegisteredDisks().sort()).toEqual(["a", "b"]);
  });

  it("hasDisk checks registration", () => {
    const manager = new StorageManager();
    manager.register("uploads", new Disk("uploads", new MemoryAdapter()));
    expect(manager.hasDisk("uploads")).toBe(true);
    expect(manager.hasDisk("other")).toBe(false);
  });
});

// ============================================================
// STORAGE MODULE
// ============================================================
describe("StorageModule", () => {
  it("creates manager from config", () => {
    const manager = StorageModule.create({
      disks: {
        local: { adapter: "memory" },
        uploads: { adapter: "memory", baseUrl: "https://cdn.example.com" },
      },
      default: "local",
    });

    expect(manager.hasDisk("local")).toBe(true);
    expect(manager.hasDisk("uploads")).toBe(true);
    expect(manager.disk().name).toBe("local");
  });

  it("createMemory returns memory-backed setup", async () => {
    const { manager, disk, adapter } = StorageModule.createMemory();
    expect(manager.disk()).toBe(disk);

    await disk.write("test.txt", "hello");
    expect(adapter.fileCount).toBe(1);
  });

  it("createDisk creates a disk from config", async () => {
    const disk = StorageModule.createDisk("test", { adapter: "memory" });
    await disk.write("file.txt", "data");
    expect(await disk.exists("file.txt")).toBe(true);
  });

  it("creates local adapter from config", () => {
    const adapter = StorageModule.createAdapter({ adapter: "local", basePath: "/tmp/test" });
    expect(adapter).toBeInstanceOf(LocalAdapter);
  });

  it("creates memory adapter from config", () => {
    const adapter = StorageModule.createAdapter({ adapter: "memory" });
    expect(adapter).toBeInstanceOf(MemoryAdapter);
  });
});

// ============================================================
// ERRORS
// ============================================================
describe("Storage Errors", () => {
  it("StorageError has correct properties", () => {
    const err = new StorageError("test");
    expect(err.name).toBe("StorageError");
    expect(err.code).toBe("STORAGE_ERROR");
  });

  it("FileNotFoundError includes path", () => {
    const err = new FileNotFoundError("path/to/file.txt");
    expect(err.name).toBe("FileNotFoundError");
    expect(err.code).toBe("FILE_NOT_FOUND");
    expect(err.filePath).toBe("path/to/file.txt");
    expect(err.message).toContain("path/to/file.txt");
  });

  it("errors are instanceof StorageError", () => {
    expect(new FileNotFoundError("x")).toBeInstanceOf(StorageError);
  });
});
