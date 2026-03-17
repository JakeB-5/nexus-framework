import { describe, it, expect } from "vitest";
import {
  OpenApiBuilder,
  generateSpec,
  convertPathParams,
  extractPathParams,
  typeToSchema,
  objectSchema,
  arraySchema,
  oneOfSchema,
  anyOfSchema,
  allOfSchema,
  enumSchema,
  refSchema,
  nullable,
  validateSpec,
  assertValidSpec,
  getSwaggerUIHtml,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiBasicAuth,
  ApiKeyAuth,
  ApiHeader,
  ApiExclude,
  getEndpointMetadata,
  OpenApiModule,
  OpenApiError,
  SpecValidationError,
  type OpenApiSpec,
  type RouteInfo,
} from "../src/index.js";

// ─── Schema Converter Tests ───────────────────────────────────────────────

describe("Schema Converter", () => {
  it("should convert primitive types", () => {
    expect(typeToSchema("string")).toEqual({ type: "string" });
    expect(typeToSchema("number")).toEqual({ type: "number" });
    expect(typeToSchema("integer")).toEqual({ type: "integer" });
    expect(typeToSchema("boolean")).toEqual({ type: "boolean" });
  });

  it("should convert format types", () => {
    expect(typeToSchema("date")).toEqual({ type: "string", format: "date" });
    expect(typeToSchema("datetime")).toEqual({ type: "string", format: "date-time" });
    expect(typeToSchema("email")).toEqual({ type: "string", format: "email" });
    expect(typeToSchema("uuid")).toEqual({ type: "string", format: "uuid" });
    expect(typeToSchema("uri")).toEqual({ type: "string", format: "uri" });
  });

  it("should convert array types", () => {
    expect(typeToSchema("string[]")).toEqual({ type: "array", items: { type: "string" } });
    expect(typeToSchema("Array<number>")).toEqual({ type: "array", items: { type: "number" } });
  });

  it("should convert unknown types to $ref", () => {
    expect(typeToSchema("User")).toEqual({ $ref: "#/components/schemas/User" });
  });

  it("should build object schemas", () => {
    const schema = objectSchema({
      properties: { name: "string", age: "integer" },
      required: ["name"],
      description: "A user",
    });
    expect(schema.type).toBe("object");
    expect(schema.properties?.name).toEqual({ type: "string" });
    expect(schema.required).toEqual(["name"]);
  });

  it("should build array schemas", () => {
    const schema = arraySchema("string", { minItems: 1, maxItems: 10 });
    expect(schema.type).toBe("array");
    expect(schema.items).toEqual({ type: "string" });
    expect(schema.minItems).toBe(1);
    expect(schema.maxItems).toBe(10);
  });

  it("should build oneOf schemas", () => {
    const schema = oneOfSchema("string", "integer");
    expect(schema.oneOf).toHaveLength(2);
  });

  it("should build anyOf schemas", () => {
    const schema = anyOfSchema("string", { type: "null" });
    expect(schema.anyOf).toHaveLength(2);
  });

  it("should build allOf schemas", () => {
    const schema = allOfSchema("User", { type: "object", properties: { extra: { type: "string" } } });
    expect(schema.allOf).toHaveLength(2);
  });

  it("should build enum schemas", () => {
    const schema = enumSchema(["ACTIVE", "INACTIVE"]);
    expect(schema.enum).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("should build ref schemas", () => {
    expect(refSchema("User")).toEqual({ $ref: "#/components/schemas/User" });
  });

  it("should make nullable schemas", () => {
    const schema = nullable({ type: "string" });
    expect(schema.nullable).toBe(true);
    expect(schema.type).toBe("string");
  });
});

// ─── OpenApiBuilder Tests ─────────────────────────────────────────────────

describe("OpenApiBuilder", () => {
  it("should build a basic spec", () => {
    const spec = new OpenApiBuilder()
      .info("My API", "1.0.0", "Test API")
      .build();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("My API");
    expect(spec.info.version).toBe("1.0.0");
  });

  it("should add servers", () => {
    const spec = new OpenApiBuilder()
      .server("https://api.example.com", "Production")
      .server("https://staging.example.com", "Staging")
      .build();
    expect(spec.servers).toHaveLength(2);
    expect(spec.servers![0].url).toBe("https://api.example.com");
  });

  it("should add paths with operations", () => {
    const spec = new OpenApiBuilder()
      .get("/users", {
        summary: "List users",
        responses: { "200": { description: "Success" } },
      })
      .post("/users", {
        summary: "Create user",
        responses: { "201": { description: "Created" } },
      })
      .build();
    expect(spec.paths["/users"].get?.summary).toBe("List users");
    expect(spec.paths["/users"].post?.summary).toBe("Create user");
  });

  it("should add components", () => {
    const spec = new OpenApiBuilder()
      .component("User", {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
      })
      .build();
    expect(spec.components?.schemas?.User).toBeDefined();
  });

  it("should add security schemes", () => {
    const spec = new OpenApiBuilder()
      .securityScheme("BearerAuth", {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      })
      .build();
    expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
  });

  it("should add tags", () => {
    const spec = new OpenApiBuilder()
      .tag("Users", "User management")
      .tag("Auth", "Authentication")
      .build();
    expect(spec.tags).toHaveLength(2);
  });

  it("should support fluent chaining", () => {
    const spec = new OpenApiBuilder()
      .info("API", "2.0.0")
      .server("https://api.example.com")
      .tag("Users")
      .get("/health", { responses: { "200": { description: "OK" } } })
      .build();
    expect(spec.info.version).toBe("2.0.0");
    expect(spec.servers).toHaveLength(1);
    expect(spec.paths["/health"]).toBeDefined();
  });

  it("should produce JSON string", () => {
    const json = new OpenApiBuilder()
      .info("API", "1.0.0")
      .toJSON();
    const parsed = JSON.parse(json);
    expect(parsed.openapi).toBe("3.1.0");
  });

  it("should merge path operations", () => {
    const spec = new OpenApiBuilder()
      .get("/items", { responses: { "200": { description: "List" } } })
      .post("/items", { responses: { "201": { description: "Created" } } })
      .build();
    expect(spec.paths["/items"].get).toBeDefined();
    expect(spec.paths["/items"].post).toBeDefined();
  });

  it("should add put, delete, patch operations", () => {
    const spec = new OpenApiBuilder()
      .put("/items/{id}", { responses: { "200": { description: "Updated" } } })
      .delete("/items/{id}", { responses: { "204": { description: "Deleted" } } })
      .patch("/items/{id}", { responses: { "200": { description: "Patched" } } })
      .build();
    expect(spec.paths["/items/{id}"].put).toBeDefined();
    expect(spec.paths["/items/{id}"].delete).toBeDefined();
    expect(spec.paths["/items/{id}"].patch).toBeDefined();
  });
});

// ─── Generator Tests ──────────────────────────────────────────────────────

describe("Generator", () => {
  it("should convert path params from Express to OpenAPI style", () => {
    expect(convertPathParams("/users/:id")).toBe("/users/{id}");
    expect(convertPathParams("/users/:userId/posts/:postId")).toBe("/users/{userId}/posts/{postId}");
    expect(convertPathParams("/users")).toBe("/users");
  });

  it("should extract path params", () => {
    expect(extractPathParams("/users/:id")).toEqual(["id"]);
    expect(extractPathParams("/users/:userId/posts/:postId")).toEqual(["userId", "postId"]);
    expect(extractPathParams("/users")).toEqual([]);
  });

  it("should generate spec from routes", () => {
    const routes: RouteInfo[] = [
      { method: "GET", path: "/users", handler: {}, handlerMethod: "list" },
      { method: "POST", path: "/users", handler: {}, handlerMethod: "create" },
      { method: "GET", path: "/users/:id", handler: {}, handlerMethod: "get" },
    ];
    const spec = generateSpec({
      title: "Test API",
      version: "1.0.0",
      routes,
    });
    expect(spec.info.title).toBe("Test API");
    expect(spec.paths["/users"]?.get).toBeDefined();
    expect(spec.paths["/users"]?.post).toBeDefined();
    expect(spec.paths["/users/{id}"]?.get).toBeDefined();
  });

  it("should include servers", () => {
    const spec = generateSpec({
      routes: [],
      servers: [{ url: "https://api.example.com" }],
    });
    expect(spec.servers).toHaveLength(1);
  });

  it("should include tags", () => {
    const spec = generateSpec({
      routes: [],
      tags: [{ name: "Users" }],
    });
    expect(spec.tags).toHaveLength(1);
  });

  it("should use decorator metadata when available", () => {
    class UserController {
      getUser() { return null; }
    }
    ApiOperation("Get a user", "Retrieve user by ID")(UserController.prototype, "getUser", Object.getOwnPropertyDescriptor(UserController.prototype, "getUser")!);
    ApiParam("id", { description: "User ID" })(UserController.prototype, "getUser", Object.getOwnPropertyDescriptor(UserController.prototype, "getUser")!);
    ApiResponse(200, { type: "object" }, "Success")(UserController.prototype, "getUser", Object.getOwnPropertyDescriptor(UserController.prototype, "getUser")!);

    const spec = generateSpec({
      routes: [{
        method: "GET",
        path: "/users/:id",
        handler: new UserController(),
        handlerMethod: "getUser",
        controllerClass: UserController,
      }],
    });
    const op = spec.paths["/users/{id}"]?.get;
    expect(op?.summary).toBe("Get a user");
    expect(op?.description).toBe("Retrieve user by ID");
    expect(op?.parameters).toHaveLength(1);
    expect(op?.responses["200"]).toBeDefined();
  });

  it("should exclude endpoints with ApiExclude", () => {
    class Controller {
      hidden() { return null; }
    }
    ApiExclude()(Controller.prototype, "hidden", Object.getOwnPropertyDescriptor(Controller.prototype, "hidden")!);

    const spec = generateSpec({
      routes: [{
        method: "GET",
        path: "/hidden",
        handler: new Controller(),
        handlerMethod: "hidden",
        controllerClass: Controller,
      }],
    });
    expect(spec.paths["/hidden"]).toBeUndefined();
  });
});

// ─── Decorator Tests ──────────────────────────────────────────────────────

describe("Decorators", () => {
  it("should store ApiOperation metadata", () => {
    class TestCtrl { test() {} }
    ApiOperation("Test op", "Description")(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.operation?.summary).toBe("Test op");
  });

  it("should store ApiParam metadata", () => {
    class TestCtrl { test() {} }
    ApiParam("id", { description: "The ID" })(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    const params = meta?.get("test")?.params;
    expect(params).toHaveLength(1);
    expect(params![0].name).toBe("id");
    expect(params![0].in).toBe("path");
  });

  it("should store ApiQuery metadata", () => {
    class TestCtrl { test() {} }
    ApiQuery("page", { description: "Page number" })(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.params[0].in).toBe("query");
  });

  it("should store ApiBody metadata", () => {
    class TestCtrl { test() {} }
    ApiBody({ type: "object" }, { description: "Request body" })(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.body?.schema.type).toBe("object");
  });

  it("should store ApiResponse metadata", () => {
    class TestCtrl { test() {} }
    ApiResponse(200, { type: "object" }, "OK")(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    ApiResponse(404, undefined, "Not found")(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.responses).toHaveLength(2);
  });

  it("should store ApiTags metadata", () => {
    class TestCtrl { test() {} }
    ApiTags("Users", "Admin")(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.tags).toEqual(["Users", "Admin"]);
  });

  it("should store security metadata", () => {
    class TestCtrl { test() {} }
    ApiBearerAuth()(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.security[0].type).toBe("bearer");
  });

  it("should store basic auth metadata", () => {
    class TestCtrl { test() {} }
    ApiBasicAuth()(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.security[0].type).toBe("basic");
  });

  it("should store API key auth metadata", () => {
    class TestCtrl { test() {} }
    ApiKeyAuth("X-API-Key", "header")(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    const sec = meta?.get("test")?.security[0];
    expect(sec?.type).toBe("apiKey");
    expect(sec?.name).toBe("X-API-Key");
  });

  it("should store ApiHeader metadata", () => {
    class TestCtrl { test() {} }
    ApiHeader("X-Request-Id", { description: "Request ID" })(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.headers[0].name).toBe("X-Request-Id");
  });

  it("should store ApiExclude metadata", () => {
    class TestCtrl { test() {} }
    ApiExclude()(TestCtrl.prototype, "test", Object.getOwnPropertyDescriptor(TestCtrl.prototype, "test")!);
    const meta = getEndpointMetadata(TestCtrl);
    expect(meta?.get("test")?.excluded).toBe(true);
  });
});

// ─── Validator Tests ──────────────────────────────────────────────────────

describe("Spec Validator", () => {
  it("should validate a correct spec", () => {
    const spec: OpenApiSpec = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/users": {
          get: { responses: { "200": { description: "OK" } } },
        },
      },
    };
    expect(validateSpec(spec)).toHaveLength(0);
  });

  it("should detect missing info", () => {
    const errors = validateSpec({ openapi: "3.1.0", info: {} as OpenApiSpec["info"], paths: {} });
    expect(errors.some(e => e.includes("info.title"))).toBe(true);
  });

  it("should detect invalid path", () => {
    const errors = validateSpec({
      openapi: "3.1.0",
      info: { title: "T", version: "1" },
      paths: { "users": { get: { responses: { "200": { description: "OK" } } } } },
    });
    expect(errors.some(e => e.includes("start with /"))).toBe(true);
  });

  it("should detect missing responses", () => {
    const errors = validateSpec({
      openapi: "3.1.0",
      info: { title: "T", version: "1" },
      paths: { "/x": { get: { responses: {} } } },
    });
    expect(errors.some(e => e.includes("at least one response"))).toBe(true);
  });

  it("should detect unresolved $ref", () => {
    const errors = validateSpec({
      openapi: "3.1.0",
      info: { title: "T", version: "1" },
      paths: {
        "/x": {
          get: {
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Missing" },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(errors.some(e => e.includes("Unresolved $ref"))).toBe(true);
  });

  it("should throw with assertValidSpec", () => {
    expect(() => assertValidSpec({
      openapi: "3.1.0",
      info: {} as OpenApiSpec["info"],
      paths: {},
    })).toThrow(SpecValidationError);
  });

  it("should detect undeclared path parameters", () => {
    const errors = validateSpec({
      openapi: "3.1.0",
      info: { title: "T", version: "1" },
      paths: {
        "/users/{id}": {
          get: { responses: { "200": { description: "OK" } } },
        },
      },
    });
    expect(errors.some(e => e.includes("path has parameters"))).toBe(true);
  });
});

// ─── Swagger UI Tests ─────────────────────────────────────────────────────

describe("Swagger UI", () => {
  it("should generate HTML with defaults", () => {
    const html = getSwaggerUIHtml();
    expect(html).toContain("swagger-ui");
    expect(html).toContain("/openapi.json");
  });

  it("should accept custom options", () => {
    const html = getSwaggerUIHtml({
      title: "My Docs",
      specUrl: "/api/spec.json",
    });
    expect(html).toContain("My Docs");
    expect(html).toContain("/api/spec.json");
  });

  it("should escape HTML in title", () => {
    const html = getSwaggerUIHtml({ title: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ─── Module Tests ─────────────────────────────────────────────────────────

describe("OpenApiModule", () => {
  it("should create module with forRoot", () => {
    const config = OpenApiModule.forRoot({ title: "API", version: "2.0.0" });
    expect(config.module).toBe(OpenApiModule);
    expect(config.providers).toHaveLength(2);
  });

  it("should serve docs page", () => {
    const mod = new OpenApiModule({ title: "Test API" });
    const res = mod.handleRequest("/docs");
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    expect(res!.contentType).toContain("text/html");
    expect(res!.body).toContain("swagger-ui");
  });

  it("should serve spec JSON", () => {
    const mod = new OpenApiModule({ title: "Test API", version: "1.0.0" });
    const res = mod.handleRequest("/openapi.json");
    expect(res).toBeDefined();
    const spec = JSON.parse(res!.body);
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Test API");
  });

  it("should return undefined for unknown paths", () => {
    const mod = new OpenApiModule();
    expect(mod.handleRequest("/unknown")).toBeUndefined();
  });

  it("should allow setting spec", () => {
    const mod = new OpenApiModule();
    const spec: OpenApiSpec = {
      openapi: "3.1.0",
      info: { title: "Set", version: "1.0.0" },
      paths: {},
    };
    mod.setSpec(spec);
    expect(mod.getSpec()).toBe(spec);
  });

  it("should use custom paths", () => {
    const mod = new OpenApiModule({ docsPath: "/api-docs", specPath: "/api/spec" });
    expect(mod.getDocsPath()).toBe("/api-docs");
    expect(mod.getSpecPath()).toBe("/api/spec");
    expect(mod.handleRequest("/api-docs")).toBeDefined();
    expect(mod.handleRequest("/api/spec")).toBeDefined();
  });
});

// ─── Error Tests ──────────────────────────────────────────────────────────

describe("Errors", () => {
  it("should create OpenApiError", () => {
    const err = new OpenApiError("test", "TEST_CODE");
    expect(err.code).toBe("TEST_CODE");
    expect(err.name).toBe("OpenApiError");
  });

  it("should create SpecValidationError with violations", () => {
    const err = new SpecValidationError(["error 1", "error 2"]);
    expect(err.violations).toHaveLength(2);
    expect(err.message).toContain("2 validation error");
    expect(err.code).toBe("SPEC_VALIDATION_ERROR");
  });
});
