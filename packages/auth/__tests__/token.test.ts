import { describe, it, expect, afterEach } from "vitest";
import {
  generateToken,
  generateApiKey,
  generateRefreshToken,
  TokenBlacklist,
  RefreshTokenStore,
} from "../src/token.js";

describe("Token generation", () => {
  it("should generate a random token", () => {
    const token = generateToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(0);
  });

  it("should generate tokens with prefix", () => {
    const token = generateToken({ prefix: "rt" });
    expect(token).toMatch(/^rt_/);
  });

  it("should generate unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });

  it("should generate API key with default prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^nxs_/);
  });

  it("should generate API key with custom prefix", () => {
    const key = generateApiKey({ prefix: "sk" });
    expect(key).toMatch(/^sk_/);
  });

  it("should generate refresh token", () => {
    const token = generateRefreshToken();
    expect(token).toBeTruthy();
    expect(token.length).toBe(96); // 48 bytes hex
  });
});

describe("TokenBlacklist", () => {
  let blacklist: TokenBlacklist;

  afterEach(() => {
    blacklist?.dispose();
  });

  it("should revoke and check tokens", () => {
    blacklist = new TokenBlacklist(0);
    blacklist.revoke("token1");
    expect(blacklist.isRevoked("token1")).toBe(true);
    expect(blacklist.isRevoked("token2")).toBe(false);
  });

  it("should report size", () => {
    blacklist = new TokenBlacklist(0);
    blacklist.revoke("a");
    blacklist.revoke("b");
    expect(blacklist.size()).toBe(2);
  });

  it("should clear all tokens", () => {
    blacklist = new TokenBlacklist(0);
    blacklist.revoke("a");
    blacklist.clear();
    expect(blacklist.size()).toBe(0);
    expect(blacklist.isRevoked("a")).toBe(false);
  });

  it("should clean up expired entries", () => {
    blacklist = new TokenBlacklist(0);
    blacklist.revoke("old", Date.now() - 1000);
    blacklist.revoke("new", Date.now() + 60000);
    const removed = blacklist.cleanup();
    expect(removed).toBe(1);
    expect(blacklist.isRevoked("old")).toBe(false);
    expect(blacklist.isRevoked("new")).toBe(true);
  });

  it("should auto-expire on isRevoked check", () => {
    blacklist = new TokenBlacklist(0);
    blacklist.revoke("expired", Date.now() - 1);
    expect(blacklist.isRevoked("expired")).toBe(false);
  });
});

describe("RefreshTokenStore", () => {
  it("should store and validate tokens", () => {
    const store = new RefreshTokenStore();
    store.store("rt1", "user1", Date.now() + 60000);
    const result = store.validate("rt1");
    expect(result).toBeDefined();
    expect(result!.userId).toBe("user1");
  });

  it("should return undefined for unknown token", () => {
    const store = new RefreshTokenStore();
    expect(store.validate("unknown")).toBeUndefined();
  });

  it("should return undefined for expired token", () => {
    const store = new RefreshTokenStore();
    store.store("rt1", "user1", Date.now() - 1000);
    expect(store.validate("rt1")).toBeUndefined();
  });

  it("should consume token (single use)", () => {
    const store = new RefreshTokenStore();
    store.store("rt1", "user1", Date.now() + 60000);
    const result = store.consume("rt1");
    expect(result).toBeDefined();
    expect(store.validate("rt1")).toBeUndefined();
  });

  it("should revoke token family", () => {
    const store = new RefreshTokenStore();
    store.store("rt1", "user1", Date.now() + 60000, "family1");
    store.store("rt2", "user1", Date.now() + 60000, "family1");
    store.store("rt3", "user1", Date.now() + 60000, "family2");

    const count = store.revokeFamily("family1");
    expect(count).toBe(2);
    expect(store.validate("rt1")).toBeUndefined();
    expect(store.validate("rt3")).toBeDefined();
  });

  it("should revoke all tokens for a user", () => {
    const store = new RefreshTokenStore();
    store.store("rt1", "user1", Date.now() + 60000);
    store.store("rt2", "user1", Date.now() + 60000);
    store.store("rt3", "user2", Date.now() + 60000);

    const count = store.revokeUser("user1");
    expect(count).toBe(2);
    expect(store.size()).toBe(1);
  });

  it("should clear all tokens", () => {
    const store = new RefreshTokenStore();
    store.store("rt1", "user1", Date.now() + 60000);
    store.clear();
    expect(store.size()).toBe(0);
  });
});
