// @nexus/security - Comprehensive tests

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";
import {
  // CORS
  cors,
  isOriginAllowed,
  // CSRF
  csrf,
  generateCsrfToken,
  // Rate limiter
  rateLimit,
  TokenBucketStore,
  SlidingWindowStore,
  // Helmet
  helmet,
  buildCspHeader,
  // Sanitizer
  encodeHtml,
  stripTags,
  escapeSqlChars,
  sanitizePath,
  hasPathTraversal,
  sanitize,
  sanitizeObject,
  // IP filter
  ipFilter,
  parseCidr,
  matchesCidr,
  normalizeIp,
  isIpInList,
  // Module
  SecurityModule,
  // Errors
  SecurityError,
  CorsError,
  CsrfError,
  RateLimitError,
  IpDeniedError,
} from "../src/index.js";

// ============================================================
// MOCK HELPERS
// ============================================================

function createMockReq(overrides: Partial<{
  method: string;
  url: string;
  path: string;
  ip: string;
  headers: Record<string, string | undefined>;
  cookies: Record<string, string>;
  body: unknown;
}> = {}): NexusRequestInterface {
  const headers = overrides.headers ?? {};
  return {
    raw: {} as never,
    method: (overrides.method ?? "GET") as NexusRequestInterface["method"],
    url: overrides.url ?? "/",
    path: overrides.path ?? "/",
    query: new URLSearchParams(),
    headers,
    ip: overrides.ip ?? "127.0.0.1",
    cookies: overrides.cookies ?? {},
    params: {},
    body: async () => overrides.body ?? null,
    get: (name: string) => headers[name.toLowerCase()],
  } as NexusRequestInterface;
}

function createMockRes(): NexusResponseInterface & {
  _status: number;
  _headers: Record<string, string | string[]>;
  _body: unknown;
  _ended: boolean;
  _cookies: Array<{ name: string; value: string; options?: unknown }>;
} {
  const res = {
    raw: {} as never,
    _status: 200,
    _headers: {} as Record<string, string | string[]>,
    _body: undefined as unknown,
    _ended: false,
    _cookies: [] as Array<{ name: string; value: string; options?: unknown }>,
    get headersSent() { return false; },
    get statusCode() { return res._status; },
    status(code: number) { res._status = code; return res; },
    header(name: string, value: string | string[]) { res._headers[name.toLowerCase()] = value; return res; },
    json(data: unknown) { res._body = data; res._ended = true; },
    text(data: string) { res._body = data; res._ended = true; },
    html(data: string) { res._body = data; res._ended = true; },
    redirect(_url: string) { res._ended = true; },
    cookie(name: string, value: string, options?: unknown) {
      res._cookies.push({ name, value, options });
      return res;
    },
    stream() { res._ended = true; },
    send(data: unknown) { res._body = data; res._ended = true; },
    end() { res._ended = true; },
  };
  return res as unknown as typeof res;
}

// ============================================================
// CORS
// ============================================================
describe("CORS", () => {
  describe("isOriginAllowed", () => {
    it("allows wildcard", () => {
      expect(isOriginAllowed("https://example.com", "*")).toBe(true);
    });

    it("allows matching string origin", () => {
      expect(isOriginAllowed("https://example.com", "https://example.com")).toBe(true);
      expect(isOriginAllowed("https://other.com", "https://example.com")).toBe(false);
    });

    it("allows array of origins", () => {
      const allowed = ["https://a.com", "https://b.com"];
      expect(isOriginAllowed("https://a.com", allowed)).toBe(true);
      expect(isOriginAllowed("https://c.com", allowed)).toBe(false);
    });

    it("allows function-based origin", () => {
      const fn = (origin: string) => origin.endsWith(".example.com");
      expect(isOriginAllowed("https://app.example.com", fn)).toBe(true);
      expect(isOriginAllowed("https://evil.com", fn)).toBe(false);
    });
  });

  describe("cors middleware", () => {
    it("sets wildcard origin by default", () => {
      const mw = cors();
      const req = createMockReq({ headers: { origin: "https://example.com" } });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._headers["access-control-allow-origin"]).toBe("*");
      expect(next).toHaveBeenCalled();
    });

    it("handles preflight OPTIONS request", () => {
      const mw = cors({ origin: "https://example.com" });
      const req = createMockReq({
        method: "OPTIONS",
        headers: { origin: "https://example.com" },
      });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._status).toBe(204);
      expect(res._headers["access-control-allow-methods"]).toBeDefined();
      expect(res._headers["access-control-allow-headers"]).toBeDefined();
      expect(next).not.toHaveBeenCalled();
    });

    it("sets credentials header", () => {
      const mw = cors({ origin: "https://example.com", credentials: true });
      const req = createMockReq({ headers: { origin: "https://example.com" } });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._headers["access-control-allow-credentials"]).toBe("true");
    });

    it("sets Vary header for specific origins", () => {
      const mw = cors({ origin: "https://example.com" });
      const req = createMockReq({ headers: { origin: "https://example.com" } });
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["vary"]).toBe("Origin");
    });

    it("sets exposed headers", () => {
      const mw = cors({ exposedHeaders: ["X-Custom", "X-Request-Id"] });
      const req = createMockReq({ headers: { origin: "https://example.com" } });
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["access-control-expose-headers"]).toBe("X-Custom, X-Request-Id");
    });

    it("skips CORS headers for disallowed origins", () => {
      const mw = cors({ origin: "https://allowed.com" });
      const req = createMockReq({ headers: { origin: "https://evil.com" } });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._headers["access-control-allow-origin"]).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});

// ============================================================
// CSRF
// ============================================================
describe("CSRF", () => {
  it("generateCsrfToken returns hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it("generateCsrfToken respects custom length", () => {
    const token = generateCsrfToken(16);
    expect(token.length).toBe(32); // 16 bytes = 32 hex chars
  });

  it("sets CSRF cookie on GET requests", async () => {
    const mw = csrf();
    const req = createMockReq({ method: "GET" });
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res._cookies.length).toBe(1);
    expect(res._cookies[0]!.name).toBe("_csrf");
    expect(next).toHaveBeenCalled();
  });

  it("validates token from header on POST", async () => {
    const token = generateCsrfToken();
    const mw = csrf();
    const req = createMockReq({
      method: "POST",
      cookies: { _csrf: token },
      headers: { "x-csrf-token": token },
    });
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects missing token on POST", async () => {
    const mw = csrf();
    const req = createMockReq({
      method: "POST",
      cookies: { _csrf: "valid-token" },
    });
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });

  it("rejects mismatched token", async () => {
    const mw = csrf();
    const req = createMockReq({
      method: "POST",
      cookies: { _csrf: "aaaa" },
      headers: { "x-csrf-token": "bbbb" },
    });
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(CsrfError));
  });

  it("skips excluded paths", async () => {
    const mw = csrf({ excludePaths: ["/api/webhook"] });
    const req = createMockReq({
      method: "POST",
      path: "/api/webhook/stripe",
      cookies: { _csrf: "token" },
    });
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("validates token from body field", async () => {
    const token = generateCsrfToken();
    const mw = csrf();
    const req = createMockReq({
      method: "POST",
      cookies: { _csrf: token },
      body: { _csrf: token },
    });
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ============================================================
// RATE LIMITER
// ============================================================
describe("Rate Limiter", () => {
  describe("SlidingWindowStore", () => {
    it("allows requests within limit", () => {
      const store = new SlidingWindowStore(3, 60000);
      const info1 = store.consume("key");
      expect(info1.remaining).toBe(2);

      const info2 = store.consume("key");
      expect(info2.remaining).toBe(1);

      const info3 = store.consume("key");
      expect(info3.remaining).toBe(0);
    });

    it("blocks requests over limit", () => {
      const store = new SlidingWindowStore(2, 60000);
      store.consume("key");
      store.consume("key");
      const info = store.consume("key");
      expect(info.remaining).toBe(0);
    });

    it("tracks keys independently", () => {
      const store = new SlidingWindowStore(2, 60000);
      store.consume("a");
      store.consume("a");
      const infoA = store.consume("a");
      const infoB = store.consume("b");
      expect(infoA.remaining).toBe(0);
      expect(infoB.remaining).toBe(1);
    });
  });

  describe("TokenBucketStore", () => {
    it("allows requests when tokens available", () => {
      const store = new TokenBucketStore(10, 60000);
      const info = store.consume("key");
      expect(info.remaining).toBe(9);
    });

    it("depletes tokens", () => {
      const store = new TokenBucketStore(3, 60000);
      store.consume("key");
      store.consume("key");
      store.consume("key");
      const info = store.consume("key");
      expect(info.remaining).toBe(0);
    });
  });

  describe("rateLimit middleware", () => {
    it("sets rate limit headers", () => {
      const mw = rateLimit({ max: 10, windowMs: 60000 });
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._headers["x-ratelimit-limit"]).toBe("10");
      expect(res._headers["x-ratelimit-remaining"]).toBeDefined();
      expect(res._headers["x-ratelimit-reset"]).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it("skips when skip function returns true", () => {
      const mw = rateLimit({
        max: 1,
        windowMs: 60000,
        skip: () => true,
      });
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._headers["x-ratelimit-limit"]).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("uses custom key generator", () => {
      const mw = rateLimit({
        max: 100,
        windowMs: 60000,
        keyGenerator: (req) => req.get("x-api-key") ?? "anon",
      });

      const req1 = createMockReq({ headers: { "x-api-key": "key1" } });
      const req2 = createMockReq({ headers: { "x-api-key": "key2" } });
      const res1 = createMockRes();
      const res2 = createMockRes();

      mw(req1, res1, vi.fn());
      mw(req2, res2, vi.fn());

      // Both should have full quota
      expect(res1._headers["x-ratelimit-remaining"]).toBe("99");
      expect(res2._headers["x-ratelimit-remaining"]).toBe("99");
    });

    it("returns 429 with token bucket when exhausted", () => {
      const mw = rateLimit({ max: 1, windowMs: 60000, algorithm: "token-bucket" });

      // Use up the token
      const req1 = createMockReq({ ip: "1.2.3.4" });
      const res1 = createMockRes();
      mw(req1, res1, vi.fn());

      // Second request should be rate limited
      const req2 = createMockReq({ ip: "1.2.3.4" });
      const res2 = createMockRes();
      const next2 = vi.fn();
      mw(req2, res2, next2);

      expect(res2._status).toBe(429);
      expect(next2).not.toHaveBeenCalled();
    });
  });
});

// ============================================================
// HELMET
// ============================================================
describe("Helmet", () => {
  describe("buildCspHeader", () => {
    it("builds CSP header from directives", () => {
      const header = buildCspHeader({
        directives: {
          "default-src": "'self'",
          "script-src": ["'self'", "https://cdn.example.com"],
          "img-src": "*",
        },
      });
      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src 'self' https://cdn.example.com");
      expect(header).toContain("img-src *");
    });

    it("converts camelCase directives", () => {
      const header = buildCspHeader({
        directives: {
          defaultSrc: "'self'",
          scriptSrc: "'none'",
        },
      });
      expect(header).toContain("default-src 'self'");
      expect(header).toContain("script-src 'none'");
    });
  });

  describe("helmet middleware", () => {
    it("sets default security headers", () => {
      const mw = helmet();
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res._headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res._headers["x-content-type-options"]).toBe("nosniff");
      expect(res._headers["x-xss-protection"]).toBe("0");
      expect(res._headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(res._headers["x-dns-prefetch-control"]).toBe("off");
      expect(res._headers["x-permitted-cross-domain-policies"]).toBe("none");
      expect(res._headers["x-download-options"]).toBe("noopen");
      expect(next).toHaveBeenCalled();
    });

    it("sets HSTS header", () => {
      const mw = helmet({ hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } });
      const req = createMockReq();
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["strict-transport-security"]).toBe(
        "max-age=31536000; includeSubDomains; preload"
      );
    });

    it("sets CSP header", () => {
      const mw = helmet({
        contentSecurityPolicy: {
          directives: { "default-src": "'self'" },
        },
      });
      const req = createMockReq();
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["content-security-policy"]).toBe("default-src 'self'");
    });

    it("uses report-only CSP", () => {
      const mw = helmet({
        contentSecurityPolicy: {
          directives: { "default-src": "'self'" },
          reportOnly: true,
        },
      });
      const req = createMockReq();
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["content-security-policy-report-only"]).toBe("default-src 'self'");
    });

    it("disables individual headers", () => {
      const mw = helmet({
        frameguard: false,
        hsts: false,
        noSniff: false,
        xssFilter: false,
      });
      const req = createMockReq();
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["x-frame-options"]).toBeUndefined();
      expect(res._headers["strict-transport-security"]).toBeUndefined();
      expect(res._headers["x-content-type-options"]).toBeUndefined();
      expect(res._headers["x-xss-protection"]).toBeUndefined();
    });

    it("sets X-Frame-Options to DENY", () => {
      const mw = helmet({ frameguard: { action: "deny" } });
      const req = createMockReq();
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(res._headers["x-frame-options"]).toBe("DENY");
    });
  });
});

// ============================================================
// SANITIZER
// ============================================================
describe("Sanitizer", () => {
  describe("encodeHtml", () => {
    it("encodes HTML entities", () => {
      expect(encodeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("encodes ampersands and quotes", () => {
      expect(encodeHtml('a & "b"')).toBe("a &amp; &quot;b&quot;");
    });

    it("handles empty string", () => {
      expect(encodeHtml("")).toBe("");
    });
  });

  describe("stripTags", () => {
    it("removes all HTML tags", () => {
      expect(stripTags("<p>Hello <b>world</b></p>")).toBe("Hello world");
    });

    it("preserves allowed tags", () => {
      const result = stripTags("<p>Hello <b>world</b> <script>evil</script></p>", ["b", "p"]);
      expect(result).toContain("<b>world</b>");
      expect(result).toContain("<p>");
      expect(result).not.toContain("<script>");
    });

    it("handles string with no tags", () => {
      expect(stripTags("plain text")).toBe("plain text");
    });
  });

  describe("escapeSqlChars", () => {
    it("escapes single quotes", () => {
      expect(escapeSqlChars("O'Reilly")).toBe("O\\'Reilly");
    });

    it("escapes backslashes", () => {
      expect(escapeSqlChars("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("escapes null bytes", () => {
      expect(escapeSqlChars("hello\x00world")).toBe("hello\\0world");
    });
  });

  describe("sanitizePath", () => {
    it("removes traversal segments", () => {
      expect(sanitizePath("../../etc/passwd")).toBe("etc/passwd");
    });

    it("normalizes slashes", () => {
      expect(sanitizePath("foo\\bar//baz")).toBe("foo/bar/baz");
    });

    it("removes leading and trailing slashes", () => {
      expect(sanitizePath("/foo/bar/")).toBe("foo/bar");
    });
  });

  describe("hasPathTraversal", () => {
    it("detects traversal attempts", () => {
      expect(hasPathTraversal("../etc/passwd")).toBe(true);
      expect(hasPathTraversal("foo/../../bar")).toBe(true);
    });

    it("detects double slashes", () => {
      expect(hasPathTraversal("foo//bar")).toBe(true);
    });

    it("detects absolute paths", () => {
      expect(hasPathTraversal("/etc/passwd")).toBe(true);
    });

    it("returns false for safe paths", () => {
      expect(hasPathTraversal("foo/bar/baz.txt")).toBe(false);
    });
  });

  describe("sanitize", () => {
    it("strips tags and encodes entities", () => {
      const result = sanitize("<script>alert('xss')</script>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("</script>");
    });

    it("enforces maxLength", () => {
      const result = sanitize("hello world", { maxLength: 5 });
      expect(result.length).toBe(5);
    });

    it("preserves allowed tags after encoding", () => {
      const result = sanitize("<b>bold</b><script>evil</script>", { allowedTags: ["b"] });
      expect(result).toContain("&lt;b&gt;");
    });
  });

  describe("sanitizeObject", () => {
    it("sanitizes string values in object", () => {
      const result = sanitizeObject({ name: "<b>John</b>", age: 30 });
      expect(result.name).not.toContain("<b>");
      expect(result.age).toBe(30);
    });
  });
});

// ============================================================
// IP FILTER
// ============================================================
describe("IP Filter", () => {
  describe("parseCidr", () => {
    it("parses valid CIDR", () => {
      const result = parseCidr("192.168.1.0/24");
      expect(result).not.toBeNull();
      expect(result!.ip).toEqual([192, 168, 1, 0]);
      expect(result!.prefixLength).toBe(24);
    });

    it("returns null for invalid CIDR", () => {
      expect(parseCidr("invalid")).toBeNull();
      expect(parseCidr("192.168.1.0")).toBeNull();
      expect(parseCidr("999.999.999.999/24")).toBeNull();
      expect(parseCidr("192.168.1.0/33")).toBeNull();
    });
  });

  describe("matchesCidr", () => {
    it("matches IP in CIDR range", () => {
      expect(matchesCidr("192.168.1.100", "192.168.1.0/24")).toBe(true);
      expect(matchesCidr("192.168.1.255", "192.168.1.0/24")).toBe(true);
    });

    it("rejects IP outside CIDR range", () => {
      expect(matchesCidr("192.168.2.1", "192.168.1.0/24")).toBe(false);
      expect(matchesCidr("10.0.0.1", "192.168.1.0/24")).toBe(false);
    });

    it("handles /32 (exact match)", () => {
      expect(matchesCidr("10.0.0.1", "10.0.0.1/32")).toBe(true);
      expect(matchesCidr("10.0.0.2", "10.0.0.1/32")).toBe(false);
    });

    it("handles /0 (match all)", () => {
      expect(matchesCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
    });
  });

  describe("normalizeIp", () => {
    it("normalizes IPv6-mapped IPv4", () => {
      expect(normalizeIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
    });

    it("normalizes IPv6 loopback", () => {
      expect(normalizeIp("::1")).toBe("127.0.0.1");
    });

    it("passes through normal IPv4", () => {
      expect(normalizeIp("192.168.1.1")).toBe("192.168.1.1");
    });
  });

  describe("isIpInList", () => {
    it("matches exact IPs", () => {
      expect(isIpInList("10.0.0.1", ["10.0.0.1", "10.0.0.2"])).toBe(true);
      expect(isIpInList("10.0.0.3", ["10.0.0.1", "10.0.0.2"])).toBe(false);
    });

    it("matches CIDR ranges", () => {
      expect(isIpInList("192.168.1.50", ["192.168.1.0/24"])).toBe(true);
      expect(isIpInList("192.168.2.50", ["192.168.1.0/24"])).toBe(false);
    });

    it("handles mixed list", () => {
      const list = ["10.0.0.1", "192.168.0.0/16"];
      expect(isIpInList("10.0.0.1", list)).toBe(true);
      expect(isIpInList("192.168.5.5", list)).toBe(true);
      expect(isIpInList("172.16.0.1", list)).toBe(false);
    });
  });

  describe("ipFilter middleware", () => {
    it("whitelist mode allows listed IPs", () => {
      const mw = ipFilter({ mode: "whitelist", ips: ["10.0.0.1"] });
      const req = createMockReq({ ip: "10.0.0.1" });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("whitelist mode blocks unlisted IPs", () => {
      const mw = ipFilter({ mode: "whitelist", ips: ["10.0.0.1"] });
      const req = createMockReq({ ip: "10.0.0.2" });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("blacklist mode blocks listed IPs", () => {
      const mw = ipFilter({ mode: "blacklist", ips: ["10.0.0.1"] });
      const req = createMockReq({ ip: "10.0.0.1" });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res._status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("blacklist mode allows unlisted IPs", () => {
      const mw = ipFilter({ mode: "blacklist", ips: ["10.0.0.1"] });
      const req = createMockReq({ ip: "10.0.0.2" });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("uses custom handler", () => {
      const handler = vi.fn();
      const mw = ipFilter({ mode: "blacklist", ips: ["10.0.0.1"], handler });
      const req = createMockReq({ ip: "10.0.0.1" });
      const res = createMockRes();

      mw(req, res, vi.fn());
      expect(handler).toHaveBeenCalledWith(req, res);
    });

    it("supports CIDR in IP list", () => {
      const mw = ipFilter({ mode: "whitelist", ips: ["192.168.0.0/16"] });
      const req = createMockReq({ ip: "192.168.5.10" });
      const res = createMockRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

// ============================================================
// SECURITY MODULE
// ============================================================
describe("SecurityModule", () => {
  it("creates middleware stack with defaults", () => {
    const stack = SecurityModule.create();
    // Should have at least helmet by default
    expect(stack.length).toBeGreaterThan(0);
  });

  it("creates stack with all options", () => {
    const stack = SecurityModule.create({
      cors: { origin: "*" },
      rateLimit: { max: 100, windowMs: 60000 },
      helmet: {},
      ipFilter: { mode: "blacklist", ips: [] },
      csrf: {},
    });
    // ipFilter + rateLimit + helmet + cors + csrf = 5
    expect(stack.length).toBe(5);
  });

  it("composes middleware into single function", () => {
    const mw = SecurityModule.middleware({
      helmet: { noSniff: true, frameguard: false, hsts: false },
    });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    mw(req, res, next);
    expect(res._headers["x-content-type-options"]).toBe("nosniff");
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================
// ERRORS
// ============================================================
describe("Security Errors", () => {
  it("SecurityError has correct properties", () => {
    const err = new SecurityError("test");
    expect(err.name).toBe("SecurityError");
    expect(err.code).toBe("SECURITY_ERROR");
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("test");
  });

  it("CorsError has origin info", () => {
    const err = new CorsError("https://evil.com");
    expect(err.name).toBe("CorsError");
    expect(err.code).toBe("CORS_ORIGIN_DENIED");
    expect(err.message).toContain("https://evil.com");
  });

  it("CsrfError has correct code", () => {
    const err = new CsrfError();
    expect(err.name).toBe("CsrfError");
    expect(err.code).toBe("CSRF_TOKEN_INVALID");
    expect(err.statusCode).toBe(403);
  });

  it("RateLimitError has retry info", () => {
    const err = new RateLimitError(30000);
    expect(err.name).toBe("RateLimitError");
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(30);
  });

  it("IpDeniedError has IP", () => {
    const err = new IpDeniedError("10.0.0.1");
    expect(err.name).toBe("IpDeniedError");
    expect(err.code).toBe("IP_DENIED");
    expect(err.ip).toBe("10.0.0.1");
  });

  it("all errors extend SecurityError", () => {
    expect(new CorsError("x")).toBeInstanceOf(SecurityError);
    expect(new CsrfError()).toBeInstanceOf(SecurityError);
    expect(new RateLimitError(1000)).toBeInstanceOf(SecurityError);
    expect(new IpDeniedError("x")).toBeInstanceOf(SecurityError);
  });
});
