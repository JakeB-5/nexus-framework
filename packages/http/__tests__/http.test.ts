// @nexus/http - Comprehensive test suite
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { request as httpRequest } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
  HttpServer,
  NexusRequest,
  NexusResponse,
  MiddlewarePipeline,
  compose,
  bodyParser,
  cookieParser,
  errorHandler,
  parseCookies,
  serializeCookie,
  signCookie,
  unsignCookie,
  parseJsonBody,
  parseUrlEncodedBody,
  parseTextBody,
  parseRawBody,
  detectContentType,
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  InternalServerError,
  HttpModule,
  HTTP_SERVER_TOKEN,
} from "../src/index.js";
import type {
  MiddlewareFunction,
  ErrorMiddlewareFunction,
  NexusRequestInterface,
  NexusResponseInterface,
} from "../src/index.js";

// Helper to make HTTP requests to the test server
function makeRequest(
  port: number,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: options.path ?? "/",
        method: options.method ?? "GET",
        headers: options.headers ?? {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Create a mock IncomingMessage
function createMockReq(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[]>;
  body?: string;
} = {}): IncomingMessage {
  const readable = new Readable({
    read() {
      if (options.body) {
        this.push(Buffer.from(options.body));
      }
      this.push(null);
    },
  }) as IncomingMessage;

  readable.method = options.method ?? "GET";
  readable.url = options.url ?? "/";
  readable.headers = (options.headers ?? {}) as IncomingMessage["headers"];
  (readable as unknown as { socket: { remoteAddress: string } }).socket = {
    remoteAddress: "127.0.0.1",
  };

  return readable;
}

function createMockRes(): ServerResponse {
  const res = {
    headersSent: false,
    statusCode: 200,
    _headers: {} as Record<string, string | string[]>,
    _body: "",
    _ended: false,
    setHeader(name: string, value: string | string[]) {
      res._headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return res._headers[name.toLowerCase()];
    },
    end(data?: string) {
      if (data) res._body += data;
      res._ended = true;
    },
    write(data: string) {
      res._body += data;
      return true;
    },
    pipe() { /* noop */ },
  } as unknown as ServerResponse;
  return res;
}

// =====================================================
// ERROR CLASSES
// =====================================================
describe("HTTP Error Classes", () => {
  it("should create HttpError with correct properties", () => {
    const err = new HttpError("test error", 418, "TEAPOT", { detail: "short and stout" });
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("TEAPOT");
    expect(err.context).toEqual({ detail: "short and stout" });
    expect(err.name).toBe("HttpError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
  });

  it("should generate default code from status", () => {
    const err = new HttpError("test", 500);
    expect(err.code).toBe("HTTP_500");
  });

  it("should serialize to JSON", () => {
    const err = new HttpError("test", 400, "BAD");
    const json = err.toJSON();
    expect(json).toEqual({
      error: "HttpError",
      message: "test",
      statusCode: 400,
      code: "BAD",
      context: {},
    });
  });

  it("should serialize context in JSON when present", () => {
    const err = new HttpError("test", 400, "BAD", { field: "email" });
    const json = err.toJSON();
    expect(json.context).toEqual({ field: "email" });
  });

  it("should create BadRequestError with status 400", () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.name).toBe("BadRequestError");
    expect(err.message).toBe("Bad Request");
  });

  it("should create UnauthorizedError with status 401", () => {
    const err = new UnauthorizedError("Invalid token");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Invalid token");
  });

  it("should create ForbiddenError with status 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("should create NotFoundError with status 404", () => {
    const err = new NotFoundError("User not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("User not found");
  });

  it("should create MethodNotAllowedError with status 405", () => {
    const err = new MethodNotAllowedError();
    expect(err.statusCode).toBe(405);
    expect(err.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("should create InternalServerError with status 500", () => {
    const err = new InternalServerError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

// =====================================================
// COOKIE PARSING & SERIALIZATION
// =====================================================
describe("Cookie Parsing", () => {
  it("should parse simple cookies", () => {
    const cookies = parseCookies("name=value; session=abc123");
    expect(cookies).toEqual({ name: "value", session: "abc123" });
  });

  it("should return empty object for undefined", () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it("should return empty object for empty string", () => {
    expect(parseCookies("")).toEqual({});
  });

  it("should handle encoded values", () => {
    const cookies = parseCookies("data=%7B%22key%22%3A%22val%22%7D");
    expect(cookies.data).toBe('{"key":"val"}');
  });

  it("should handle values with equals signs", () => {
    const cookies = parseCookies("token=abc=def=ghi");
    expect(cookies.token).toBe("abc=def=ghi");
  });

  it("should skip entries without equals", () => {
    const cookies = parseCookies("valid=yes; invalid; also=good");
    expect(cookies).toEqual({ valid: "yes", also: "good" });
  });
});

describe("Cookie Serialization", () => {
  it("should serialize basic cookie", () => {
    const result = serializeCookie("name", "value");
    expect(result).toBe("name=value");
  });

  it("should serialize with path", () => {
    const result = serializeCookie("name", "value", { path: "/" });
    expect(result).toContain("Path=/");
  });

  it("should serialize with domain", () => {
    const result = serializeCookie("name", "value", { domain: "example.com" });
    expect(result).toContain("Domain=example.com");
  });

  it("should serialize with maxAge", () => {
    const result = serializeCookie("name", "value", { maxAge: 3600 });
    expect(result).toContain("Max-Age=3600");
  });

  it("should serialize with expires", () => {
    const date = new Date("2030-01-01T00:00:00Z");
    const result = serializeCookie("name", "value", { expires: date });
    expect(result).toContain("Expires=");
  });

  it("should serialize with httpOnly", () => {
    const result = serializeCookie("name", "value", { httpOnly: true });
    expect(result).toContain("HttpOnly");
  });

  it("should serialize with secure", () => {
    const result = serializeCookie("name", "value", { secure: true });
    expect(result).toContain("Secure");
  });

  it("should serialize with sameSite", () => {
    const result = serializeCookie("name", "value", { sameSite: "Strict" });
    expect(result).toContain("SameSite=Strict");
  });

  it("should serialize all options together", () => {
    const result = serializeCookie("sid", "abc123", {
      path: "/",
      domain: ".example.com",
      maxAge: 86400,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
    expect(result).toContain("sid=abc123");
    expect(result).toContain("Path=/");
    expect(result).toContain("Domain=.example.com");
    expect(result).toContain("Max-Age=86400");
    expect(result).toContain("HttpOnly");
    expect(result).toContain("Secure");
    expect(result).toContain("SameSite=Lax");
  });
});

describe("Cookie Signing", () => {
  const secret = "my-secret-key";

  it("should sign and unsign a cookie", () => {
    const signed = signCookie("hello", secret);
    expect(signed).toContain("hello.");
    expect(signed.length).toBeGreaterThan("hello.".length);

    const unsigned = unsignCookie(signed, secret);
    expect(unsigned).toBe("hello");
  });

  it("should return false for tampered cookie", () => {
    const signed = signCookie("hello", secret);
    const tampered = signed.slice(0, -1) + "X";
    expect(unsignCookie(tampered, secret)).toBe(false);
  });

  it("should return false for cookie without signature", () => {
    expect(unsignCookie("nosignature", secret)).toBe(false);
  });

  it("should return false for wrong secret", () => {
    const signed = signCookie("hello", secret);
    expect(unsignCookie(signed, "wrong-secret")).toBe(false);
  });
});

// =====================================================
// BODY PARSING
// =====================================================
describe("Body Parsing", () => {
  it("should parse JSON body", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"name":"John"}',
    });
    const result = await parseJsonBody(req);
    expect(result).toEqual({ name: "John" });
  });

  it("should return undefined for empty JSON body", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    });
    const result = await parseJsonBody(req);
    expect(result).toBeUndefined();
  });

  it("should throw BadRequestError for invalid JSON", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    await expect(parseJsonBody(req)).rejects.toThrow(BadRequestError);
  });

  it("should enforce strict mode for JSON", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '"just a string"',
    });
    await expect(parseJsonBody(req, { strict: true })).rejects.toThrow("strict mode");
  });

  it("should parse URL-encoded body", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "name=John&age=30",
    });
    const result = await parseUrlEncodedBody(req);
    expect(result).toEqual({ name: "John", age: "30" });
  });

  it("should handle multiple values in URL-encoded body", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "tag=a&tag=b&tag=c",
    });
    const result = await parseUrlEncodedBody(req);
    expect(result.tag).toEqual(["a", "b", "c"]);
  });

  it("should return empty object for empty URL-encoded body", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "",
    });
    const result = await parseUrlEncodedBody(req);
    expect(result).toEqual({});
  });

  it("should parse text body", async () => {
    const req = createMockReq({
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "Hello World",
    });
    const result = await parseTextBody(req);
    expect(result).toBe("Hello World");
  });

  it("should parse raw body as Buffer", async () => {
    const req = createMockReq({
      method: "POST",
      body: "raw data",
    });
    const result = await parseRawBody(req);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("raw data");
  });

  it("should detect content types correctly", () => {
    expect(detectContentType("application/json")).toBe("json");
    expect(detectContentType("application/json; charset=utf-8")).toBe("json");
    expect(detectContentType("application/x-www-form-urlencoded")).toBe("urlencoded");
    expect(detectContentType("text/plain")).toBe("text");
    expect(detectContentType("text/html")).toBe("text");
    expect(detectContentType("application/octet-stream")).toBe("raw");
    expect(detectContentType(undefined)).toBe("raw");
  });
});

// =====================================================
// NEXUS REQUEST
// =====================================================
describe("NexusRequest", () => {
  it("should parse method and url", () => {
    const raw = createMockReq({ method: "POST", url: "/users" });
    const req = new NexusRequest(raw);
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/users");
    expect(req.path).toBe("/users");
  });

  it("should parse query string", () => {
    const raw = createMockReq({ url: "/search?q=hello&page=2" });
    const req = new NexusRequest(raw);
    expect(req.path).toBe("/search");
    expect(req.query.get("q")).toBe("hello");
    expect(req.query.get("page")).toBe("2");
  });

  it("should handle URL without query string", () => {
    const raw = createMockReq({ url: "/users" });
    const req = new NexusRequest(raw);
    expect(req.path).toBe("/users");
    expect(req.query.toString()).toBe("");
  });

  it("should default to GET method", () => {
    const raw = createMockReq({});
    const req = new NexusRequest(raw);
    expect(req.method).toBe("GET");
  });

  it("should get header value", () => {
    const raw = createMockReq({
      headers: { "content-type": "application/json", "x-custom": "value" },
    });
    const req = new NexusRequest(raw);
    expect(req.get("content-type")).toBe("application/json");
    expect(req.get("x-custom")).toBe("value");
  });

  it("should return client IP", () => {
    const raw = createMockReq({});
    const req = new NexusRequest(raw);
    expect(req.ip).toBe("127.0.0.1");
  });

  it("should use x-forwarded-for when trustProxy is enabled", () => {
    const raw = createMockReq({
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    const req = new NexusRequest(raw, true);
    expect(req.ip).toBe("203.0.113.50");
  });

  it("should ignore x-forwarded-for when trustProxy is disabled", () => {
    const raw = createMockReq({
      headers: { "x-forwarded-for": "203.0.113.50" },
    });
    const req = new NexusRequest(raw, false);
    expect(req.ip).toBe("127.0.0.1");
  });

  it("should parse cookies from header", () => {
    const raw = createMockReq({
      headers: { cookie: "session=abc; theme=dark" },
    });
    const req = new NexusRequest(raw);
    expect(req.cookies).toEqual({ session: "abc", theme: "dark" });
  });

  it("should lazy-parse cookies once", () => {
    const raw = createMockReq({
      headers: { cookie: "a=1" },
    });
    const req = new NexusRequest(raw);
    const c1 = req.cookies;
    const c2 = req.cookies;
    expect(c1).toBe(c2); // Same reference
  });

  it("should allow setting params", () => {
    const raw = createMockReq({});
    const req = new NexusRequest(raw);
    req.params = { id: "123", name: "test" };
    expect(req.params.id).toBe("123");
  });

  it("should parse body", async () => {
    const raw = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"key":"value"}',
    });
    const req = new NexusRequest(raw);
    const body = await req.body();
    expect(body).toEqual({ key: "value" });
  });

  it("should cache body after first parse", async () => {
    const raw = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"key":"value"}',
    });
    const req = new NexusRequest(raw);
    const b1 = await req.body();
    const b2 = await req.body();
    expect(b1).toBe(b2); // Same reference
  });
});

// =====================================================
// NEXUS RESPONSE
// =====================================================
describe("NexusResponse", () => {
  it("should set status code", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    const result = res.status(201);
    expect(result).toBe(res); // Chainable
    expect(res.statusCode).toBe(201);
  });

  it("should set headers", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    const result = res.header("X-Custom", "value");
    expect(result).toBe(res); // Chainable
  });

  it("should send JSON response", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.json({ message: "hello" });
    expect((raw as unknown as { _body: string })._body).toBe('{"message":"hello"}');
  });

  it("should send text response", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.text("Hello World");
    expect((raw as unknown as { _body: string })._body).toBe("Hello World");
  });

  it("should send HTML response", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.html("<h1>Hello</h1>");
    expect((raw as unknown as { _body: string })._body).toBe("<h1>Hello</h1>");
  });

  it("should redirect", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.redirect("/login");
    expect(raw.statusCode).toBe(302);
    expect((raw as unknown as { _headers: Record<string, string> })._headers["location"]).toBe("/login");
  });

  it("should redirect with custom status", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.redirect("/new-location", 301);
    expect(raw.statusCode).toBe(301);
  });

  it("should set cookies", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.cookie("session", "abc123", { httpOnly: true, path: "/" });
    const setCookie = (raw as unknown as { _headers: Record<string, string | string[]> })._headers["set-cookie"];
    expect(setCookie).toContain("session=abc123");
    expect(setCookie).toContain("HttpOnly");
  });

  it("should append multiple cookies", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.cookie("a", "1").cookie("b", "2");
    const setCookie = (raw as unknown as { _headers: Record<string, string | string[]> })._headers["set-cookie"];
    expect(Array.isArray(setCookie)).toBe(true);
    expect((setCookie as string[]).length).toBe(2);
  });

  it("should send auto-detected content", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.send({ data: 123 });
    expect((raw as unknown as { _body: string })._body).toBe('{"data":123}');
  });

  it("should auto-detect HTML in send", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.send("<!DOCTYPE html><html></html>");
    expect((raw as unknown as { _headers: Record<string, string> })._headers["content-type"]).toContain("text/html");
  });

  it("should send null/undefined as empty", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.send(null);
    expect((raw as unknown as { _ended: boolean })._ended).toBe(true);
    expect((raw as unknown as { _body: string })._body).toBe("");
  });

  it("should send Buffer", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.send(Buffer.from("binary data"));
    expect((raw as unknown as { _headers: Record<string, string> })._headers["content-type"]).toBe("application/octet-stream");
  });

  it("should report headersSent", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    expect(res.headersSent).toBe(false);
  });

  it("should end response", () => {
    const raw = createMockRes();
    const res = new NexusResponse(raw);
    res.status(204).end();
    expect(raw.statusCode).toBe(204);
    expect((raw as unknown as { _ended: boolean })._ended).toBe(true);
  });
});

// =====================================================
// MIDDLEWARE PIPELINE
// =====================================================
describe("MiddlewarePipeline", () => {
  it("should execute middleware in order", async () => {
    const order: number[] = [];
    const pipeline = new MiddlewarePipeline();
    pipeline.use(
      (_req, _res, next) => { order.push(1); next(); },
      (_req, _res, next) => { order.push(2); next(); },
      (_req, _res, next) => { order.push(3); next(); },
    );

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await pipeline.execute(req, res);
    expect(order).toEqual([1, 2, 3]);
  });

  it("should stop on error and pass to error middleware", async () => {
    const pipeline = new MiddlewarePipeline();
    const handled: string[] = [];

    pipeline.use(
      (_req, _res, next) => { next(new Error("test error")); },
      (_req, _res, _next) => { handled.push("should-not-run"); },
      ((err: Error, _req: NexusRequestInterface, _res: NexusResponseInterface, _next) => {
        handled.push(`caught: ${err.message}`);
      }) as ErrorMiddlewareFunction,
    );

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await pipeline.execute(req, res);
    expect(handled).toEqual(["caught: test error"]);
  });

  it("should catch thrown errors", async () => {
    const pipeline = new MiddlewarePipeline();
    const handled: string[] = [];

    pipeline.use(
      () => { throw new Error("thrown"); },
      ((err: Error, _req: NexusRequestInterface, _res: NexusResponseInterface, _next) => {
        handled.push(`caught: ${err.message}`);
      }) as ErrorMiddlewareFunction,
    );

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await pipeline.execute(req, res);
    expect(handled).toEqual(["caught: thrown"]);
  });

  it("should throw unhandled errors", async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(() => { throw new Error("unhandled"); });

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await expect(pipeline.execute(req, res)).rejects.toThrow("unhandled");
  });

  it("should track length", () => {
    const pipeline = new MiddlewarePipeline();
    expect(pipeline.length).toBe(0);
    pipeline.use((_req, _res, next) => next());
    expect(pipeline.length).toBe(1);
  });

  it("should handle async middleware", async () => {
    const pipeline = new MiddlewarePipeline();
    const order: number[] = [];

    pipeline.use(
      async (_req, _res, next) => {
        await new Promise((r) => setTimeout(r, 5));
        order.push(1);
        next();
      },
      (_req, _res, next) => {
        order.push(2);
        next();
      },
    );

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await pipeline.execute(req, res);
    expect(order).toEqual([1, 2]);
  });
});

describe("compose", () => {
  it("should compose multiple middleware into one", async () => {
    const order: number[] = [];
    const composed = compose(
      (_req, _res, next) => { order.push(1); next(); },
      (_req, _res, next) => { order.push(2); next(); },
    );

    const pipeline = new MiddlewarePipeline();
    pipeline.use(composed);

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await pipeline.execute(req, res);
    expect(order).toEqual([1, 2]);
  });

  it("should stop propagation when next is not called", async () => {
    const order: number[] = [];
    const composed = compose(
      (_req, _res, _next) => { order.push(1); /* no next */ },
      (_req, _res, next) => { order.push(2); next(); },
    );

    const pipeline = new MiddlewarePipeline();
    pipeline.use(composed);

    const req = new NexusRequest(createMockReq({}));
    const res = new NexusResponse(createMockRes());
    await pipeline.execute(req, res);
    expect(order).toEqual([1]);
  });
});

// =====================================================
// HTTP SERVER (Integration)
// =====================================================
describe("HttpServer", () => {
  let server: HttpServer;
  let port: number;

  beforeEach(async () => {
    server = new HttpServer({ port: 0, host: "127.0.0.1" });
  });

  afterEach(async () => {
    if (server.listening) {
      await server.close();
    }
  });

  it("should listen and close", async () => {
    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;
    expect(server.listening).toBe(true);
    expect(server.server).toBeDefined();

    await server.close();
    expect(server.listening).toBe(false);
  });

  it("should handle GET request", async () => {
    server.onRequest((req, res) => {
      res.json({ method: req.method, path: req.path });
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port, { path: "/test" });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ method: "GET", path: "/test" });
  });

  it("should handle POST with JSON body", async () => {
    server.onRequest(async (req, res) => {
      const body = await req.body();
      res.json({ received: body });
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port, {
      method: "POST",
      path: "/data",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"test"}',
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ received: { name: "test" } });
  });

  it("should return 404 when no handler set", async () => {
    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port);
    expect(result.statusCode).toBe(404);
  });

  it("should execute middleware before handler", async () => {
    const order: string[] = [];

    server.use((_req, _res, next) => {
      order.push("middleware");
      next();
    });

    server.onRequest((_req, res) => {
      order.push("handler");
      res.json({ ok: true });
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    await makeRequest(port);
    expect(order).toEqual(["middleware", "handler"]);
  });

  it("should handle HttpError in request handler", async () => {
    server.onRequest(() => {
      throw new NotFoundError("Resource not found");
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port);
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe("NotFoundError");
    expect(body.message).toBe("Resource not found");
  });

  it("should handle non-HttpError as 500", async () => {
    server.onRequest(() => {
      throw new Error("unexpected");
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port);
    expect(result.statusCode).toBe(500);
  });

  it("should handle query parameters", async () => {
    server.onRequest((req, res) => {
      res.json({
        q: req.query.get("q"),
        page: req.query.get("page"),
      });
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port, { path: "/search?q=hello&page=2" });
    expect(JSON.parse(result.body)).toEqual({ q: "hello", page: "2" });
  });

  it("should close gracefully when not listening", async () => {
    // Should not throw
    await server.close();
  });

  it("should set status codes on response", async () => {
    server.onRequest((_req, res) => {
      res.status(201).json({ created: true });
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port);
    expect(result.statusCode).toBe(201);
  });

  it("should handle redirect", async () => {
    server.onRequest((_req, res) => {
      res.redirect("/login", 301);
    });

    const addr = await server.listen(0, "127.0.0.1");
    port = addr.port;

    const result = await makeRequest(port);
    expect(result.statusCode).toBe(301);
    expect(result.headers["location"]).toBe("/login");
  });
});

// =====================================================
// BUILT-IN MIDDLEWARE
// =====================================================
describe("Built-in Middleware", () => {
  it("bodyParser should pre-parse body", async () => {
    const mw = bodyParser();
    const raw = createMockReq({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"pre":"parsed"}',
    });
    const req = new NexusRequest(raw);
    const res = new NexusResponse(createMockRes());
    let nextCalled = false;
    await mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    // Body should now be cached
    const body = await req.body();
    expect(body).toEqual({ pre: "parsed" });
  });

  it("bodyParser should skip GET requests", async () => {
    const mw = bodyParser();
    const raw = createMockReq({ method: "GET" });
    const req = new NexusRequest(raw);
    const res = new NexusResponse(createMockRes());
    let nextCalled = false;
    await mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("cookieParser should trigger cookie parsing", () => {
    const mw = cookieParser();
    const raw = createMockReq({ headers: { cookie: "a=1" } });
    const req = new NexusRequest(raw);
    const res = new NexusResponse(createMockRes());
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("errorHandler should handle HttpError", () => {
    const mw = errorHandler();
    const req = new NexusRequest(createMockReq({}));
    const mockRaw = createMockRes();
    const res = new NexusResponse(mockRaw);
    mw(new BadRequestError("invalid input"), req, res, () => {});
    expect(mockRaw.statusCode).toBe(400);
  });

  it("errorHandler should handle generic Error as 500", () => {
    const mw = errorHandler();
    const req = new NexusRequest(createMockReq({}));
    const mockRaw = createMockRes();
    const res = new NexusResponse(mockRaw);
    mw(new Error("boom"), req, res, () => {});
    expect(mockRaw.statusCode).toBe(500);
  });
});

// =====================================================
// HTTP MODULE
// =====================================================
describe("HttpModule", () => {
  it("should register with default options", () => {
    const reg = HttpModule.register();
    expect(reg.token).toBe(HTTP_SERVER_TOKEN);
    expect(reg.options.port).toBe(3000);
    expect(reg.options.host).toBe("0.0.0.0");
    expect(reg.options.autoStart).toBe(false);
  });

  it("should register with custom options", () => {
    const reg = HttpModule.register({ port: 8080, host: "localhost", autoStart: true });
    expect(reg.options.port).toBe(8080);
    expect(reg.options.host).toBe("localhost");
    expect(reg.options.autoStart).toBe(true);
  });

  it("should create HttpServer from factory", () => {
    const reg = HttpModule.register({ port: 9090 });
    const server = reg.factory();
    expect(server).toBeInstanceOf(HttpServer);
  });

  it("should have static token", () => {
    expect(HttpModule.token).toBe(HTTP_SERVER_TOKEN);
  });
});
