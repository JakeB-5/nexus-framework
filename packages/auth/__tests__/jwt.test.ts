import { describe, it, expect, beforeEach } from "vitest";
import { sign, verify, decode, refresh } from "../src/jwt.js";
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenNotBeforeError,
} from "../src/errors.js";

const SECRET = "test-secret-key-that-is-long-enough";

describe("JWT", () => {
  describe("sign", () => {
    it("should create a valid JWT token", () => {
      const token = sign({ sub: "user1" }, SECRET);
      expect(token).toBeTruthy();
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include iat claim by default", () => {
      const token = sign({ sub: "user1" }, SECRET);
      const decoded = decode(token);
      expect(decoded.payload.iat).toBeTypeOf("number");
    });

    it("should set expiration from expiresIn", () => {
      const token = sign({ sub: "user1" }, SECRET, { expiresIn: 3600 });
      const decoded = decode(token);
      expect(decoded.payload.exp).toBeDefined();
      expect(decoded.payload.exp! - decoded.payload.iat!).toBe(3600);
    });

    it("should set issuer, audience, subject", () => {
      const token = sign({}, SECRET, {
        issuer: "nexus",
        audience: "api",
        subject: "user1",
      });
      const decoded = decode(token);
      expect(decoded.payload.iss).toBe("nexus");
      expect(decoded.payload.aud).toBe("api");
      expect(decoded.payload.sub).toBe("user1");
    });

    it("should set notBefore", () => {
      const token = sign({}, SECRET, { notBefore: 60 });
      const decoded = decode(token);
      expect(decoded.payload.nbf).toBeDefined();
    });

    it("should set jwtId", () => {
      const token = sign({}, SECRET, { jwtId: "abc-123" });
      const decoded = decode(token);
      expect(decoded.payload.jti).toBe("abc-123");
    });

    it("should support HS384 algorithm", () => {
      const token = sign({ sub: "user1" }, SECRET, { algorithm: "HS384" });
      const decoded = decode(token);
      expect(decoded.header.alg).toBe("HS384");
    });

    it("should support HS512 algorithm", () => {
      const token = sign({ sub: "user1" }, SECRET, { algorithm: "HS512" });
      const decoded = decode(token);
      expect(decoded.header.alg).toBe("HS512");
    });

    it("should include custom claims", () => {
      const token = sign({ role: "admin", org: "nexus" }, SECRET);
      const decoded = decode(token);
      expect(decoded.payload.role).toBe("admin");
      expect(decoded.payload.org).toBe("nexus");
    });

    it("should throw if secret is empty", () => {
      expect(() => sign({ sub: "user1" }, "")).toThrow(InvalidTokenError);
    });
  });

  describe("decode", () => {
    it("should decode a valid token without verification", () => {
      const token = sign({ sub: "user1", role: "admin" }, SECRET);
      const decoded = decode(token);
      expect(decoded.header.typ).toBe("JWT");
      expect(decoded.header.alg).toBe("HS256");
      expect(decoded.payload.sub).toBe("user1");
      expect(decoded.payload.role).toBe("admin");
      expect(decoded.signature).toBeTruthy();
    });

    it("should throw on invalid token format", () => {
      expect(() => decode("not-a-token")).toThrow(InvalidTokenError);
      expect(() => decode("a.b")).toThrow(InvalidTokenError);
    });

    it("should throw on invalid encoding", () => {
      expect(() => decode("!!!.!!!.!!!")).toThrow(InvalidTokenError);
    });

    it("should throw on non-string input", () => {
      expect(() => decode(123 as unknown as string)).toThrow(InvalidTokenError);
    });
  });

  describe("verify", () => {
    it("should verify a valid token", () => {
      const token = sign({ sub: "user1" }, SECRET);
      const payload = verify(token, SECRET);
      expect(payload.sub).toBe("user1");
    });

    it("should reject tampered token", () => {
      const token = sign({ sub: "user1" }, SECRET);
      const parts = token.split(".");
      parts[1] = parts[1] + "x";
      const tampered = parts.join(".");
      expect(() => verify(tampered, SECRET)).toThrow(InvalidTokenError);
    });

    it("should reject wrong secret", () => {
      const token = sign({ sub: "user1" }, SECRET);
      expect(() => verify(token, "wrong-secret")).toThrow(InvalidTokenError);
    });

    it("should reject expired token", () => {
      const token = sign({ sub: "user1" }, SECRET, { expiresIn: -10 });
      expect(() => verify(token, SECRET)).toThrow(TokenExpiredError);
    });

    it("should accept expired token with ignoreExpiration", () => {
      const token = sign({ sub: "user1" }, SECRET, { expiresIn: -10 });
      const payload = verify(token, SECRET, { ignoreExpiration: true });
      expect(payload.sub).toBe("user1");
    });

    it("should reject token used before nbf", () => {
      const token = sign({ sub: "user1" }, SECRET, { notBefore: 9999 });
      expect(() => verify(token, SECRET)).toThrow(TokenNotBeforeError);
    });

    it("should accept nbf token with ignoreNotBefore", () => {
      const token = sign({ sub: "user1" }, SECRET, { notBefore: 9999 });
      const payload = verify(token, SECRET, { ignoreNotBefore: true });
      expect(payload.sub).toBe("user1");
    });

    it("should validate issuer", () => {
      const token = sign({}, SECRET, { issuer: "nexus" });
      expect(() => verify(token, SECRET, { issuer: "other" })).toThrow(
        InvalidTokenError,
      );
      const payload = verify(token, SECRET, { issuer: "nexus" });
      expect(payload.iss).toBe("nexus");
    });

    it("should validate audience (string)", () => {
      const token = sign({}, SECRET, { audience: "api" });
      expect(() => verify(token, SECRET, { audience: "web" })).toThrow(
        InvalidTokenError,
      );
      const payload = verify(token, SECRET, { audience: "api" });
      expect(payload.aud).toBe("api");
    });

    it("should validate audience (array)", () => {
      const token = sign({}, SECRET, { audience: ["api", "web"] });
      const payload = verify(token, SECRET, { audience: "api" });
      expect(payload.aud).toContain("api");
    });

    it("should validate subject", () => {
      const token = sign({}, SECRET, { subject: "user1" });
      expect(() => verify(token, SECRET, { subject: "user2" })).toThrow(
        InvalidTokenError,
      );
    });

    it("should respect algorithm allowlist", () => {
      const token = sign({ sub: "user1" }, SECRET, { algorithm: "HS384" });
      expect(() =>
        verify(token, SECRET, { algorithms: ["HS256"] }),
      ).toThrow(InvalidTokenError);
    });

    it("should respect clockTolerance", () => {
      const token = sign({ sub: "user1" }, SECRET, { expiresIn: -5 });
      const payload = verify(token, SECRET, { clockTolerance: 10 });
      expect(payload.sub).toBe("user1");
    });

    it("should enforce maxAge", () => {
      // Create a token with iat far in the past
      const oldIat = Math.floor(Date.now() / 1000) - 7200;
      const token = sign({ sub: "user1", iat: oldIat }, SECRET);
      expect(() => verify(token, SECRET, { maxAge: 3600 })).toThrow(
        TokenExpiredError,
      );
    });

    it("should throw if secret is empty", () => {
      const token = sign({ sub: "user1" }, SECRET);
      expect(() => verify(token, "")).toThrow(InvalidTokenError);
    });
  });

  describe("refresh", () => {
    it("should create a new token with extended expiry", () => {
      const token = sign({ sub: "user1", role: "admin" }, SECRET, {
        expiresIn: 3600,
      });
      const newToken = refresh(token, SECRET, 7200);
      expect(newToken).not.toBe(token);

      const payload = verify(newToken, SECRET);
      expect(payload.sub).toBe("user1");
      expect(payload.role).toBe("admin");
      expect(payload.exp).toBeDefined();
    });

    it("should strip old iat and exp", () => {
      const pastIat = Math.floor(Date.now() / 1000) - 100;
      const token = sign({ sub: "user1", iat: pastIat }, SECRET, { expiresIn: 100 });
      const oldPayload = decode(token).payload;
      expect(oldPayload.iat).toBe(pastIat);

      const newToken = refresh(token, SECRET, 7200);
      const newPayload = decode(newToken).payload;
      expect(newPayload.iat).not.toBe(pastIat);
      expect(newPayload.exp).toBeDefined();
    });
  });
});
