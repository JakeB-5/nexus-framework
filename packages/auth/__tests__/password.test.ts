import { describe, it, expect } from "vitest";
import {
  hash,
  verify,
  generateSalt,
  parseHash,
  validatePasswordStrength,
} from "../src/password.js";

describe("Password hashing", () => {
  it("should hash a password", async () => {
    const hashed = await hash("mypassword123");
    expect(hashed).toBeTruthy();
    expect(hashed).toContain("$scrypt$");
  });

  it("should produce different hashes for same password (unique salt)", async () => {
    const h1 = await hash("mypassword");
    const h2 = await hash("mypassword");
    expect(h1).not.toBe(h2);
  });

  it("should verify correct password", async () => {
    const hashed = await hash("correct-horse");
    expect(await verify("correct-horse", hashed)).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const hashed = await hash("correct-horse");
    expect(await verify("wrong-horse", hashed)).toBe(false);
  });

  it("should return false for invalid hash format", async () => {
    expect(await verify("password", "not-a-hash")).toBe(false);
  });

  it("should generate salt of specified length", () => {
    const salt = generateSalt(16);
    // hex encoding doubles the length
    expect(salt).toHaveLength(32);
  });

  it("should generate salt with default length", () => {
    const salt = generateSalt();
    expect(salt).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it("should parse a valid hash string", async () => {
    const hashed = await hash("password");
    const parsed = parseHash(hashed);
    expect(parsed).toBeDefined();
    expect(parsed!.salt).toBeTruthy();
    expect(parsed!.hash).toBeTruthy();
    expect(parsed!.params.N).toBeTypeOf("number");
    expect(parsed!.params.r).toBeTypeOf("number");
    expect(parsed!.params.p).toBeTypeOf("number");
    expect(parsed!.params.keyLength).toBeTypeOf("number");
  });

  it("should return undefined for invalid hash string", () => {
    expect(parseHash("invalid")).toBeUndefined();
    expect(parseHash("$other$params$salt$hash")).toBeUndefined();
  });
});

describe("Password strength validation", () => {
  it("should reject short passwords", () => {
    const result = validatePasswordStrength("short");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should require lowercase", () => {
    const result = validatePasswordStrength("ABCDEFGH1!");
    expect(result.errors).toContain(
      "Password must contain at least one lowercase letter",
    );
  });

  it("should require uppercase", () => {
    const result = validatePasswordStrength("abcdefgh1!");
    expect(result.errors).toContain(
      "Password must contain at least one uppercase letter",
    );
  });

  it("should require digit", () => {
    const result = validatePasswordStrength("Abcdefgh!");
    expect(result.errors).toContain(
      "Password must contain at least one digit",
    );
  });

  it("should require special character", () => {
    const result = validatePasswordStrength("Abcdefgh1");
    expect(result.errors).toContain(
      "Password must contain at least one special character",
    );
  });

  it("should accept a strong password", () => {
    const result = validatePasswordStrength("MyStr0ng!Pass");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(5);
  });

  it("should give higher score for longer passwords", () => {
    const short = validatePasswordStrength("Aa1!abcd");
    const long = validatePasswordStrength("Aa1!abcdefghijklmnop");
    expect(long.score).toBeGreaterThan(short.score);
  });
});
