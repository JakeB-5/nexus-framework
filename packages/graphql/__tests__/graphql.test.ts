import { describe, it, expect, beforeEach } from "vitest";
import {
  parse,
  Lexer,
  TokenKind,
  NodeKind,
  OperationType,
  buildSchema,
  execute,
  validate,
  PubSub,
  ConnectionManager,
  withFilter,
  createHttpHandler,
  getGraphiQLHtml,
  GraphQLModule,
  GraphQLError,
  GraphQLSyntaxError,
  GraphQLValidationError,
  GraphQLExecutionError,
  SchemaError,
  formatErrors,
  TypeRegistry,
  createScalarType,
  validateSchema,
  applyResolvers,
  buildResolverMap,
  Resolver,
  Query,
  Mutation,
  Field,
  Arg,
  Ctx,
  Info,
  getResolverMetadata,
  calculateDepth,
  calculateComplexity,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  BUILT_IN_SCALARS,
  type DocumentNode,
  type GraphQLSchema,
  type HttpRequest,
} from "../src/index.js";

// ─── Lexer Tests ──────────────────────────────────────────────────────────

describe("Lexer", () => {
  it("should tokenize punctuation", () => {
    const lexer = new Lexer("{ } ( ) : ! @ [ ] | ...");
    const tokens: string[] = [];
    let tok = lexer.nextToken();
    while (tok.kind !== TokenKind.EOF) {
      tokens.push(tok.kind);
      tok = lexer.nextToken();
    }
    expect(tokens).toEqual([
      TokenKind.BraceL, TokenKind.BraceR,
      TokenKind.ParenL, TokenKind.ParenR,
      TokenKind.Colon, TokenKind.Bang,
      TokenKind.At, TokenKind.BracketL,
      TokenKind.BracketR, TokenKind.Pipe,
      TokenKind.Spread,
    ]);
  });

  it("should tokenize names", () => {
    const lexer = new Lexer("query myQuery");
    const t1 = lexer.nextToken();
    const t2 = lexer.nextToken();
    expect(t1.kind).toBe(TokenKind.Name);
    expect(t1.value).toBe("query");
    expect(t2.kind).toBe(TokenKind.Name);
    expect(t2.value).toBe("myQuery");
  });

  it("should tokenize numbers", () => {
    const lexer = new Lexer("42 -3 3.14 1e10");
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.Int, value: "42" });
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.Int, value: "-3" });
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.Float, value: "3.14" });
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.Float, value: "1e10" });
  });

  it("should tokenize strings", () => {
    const lexer = new Lexer('"hello" "esc\\nape"');
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.String, value: "hello" });
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.String, value: "esc\nape" });
  });

  it("should skip comments", () => {
    const lexer = new Lexer("# comment\nfoo");
    expect(lexer.nextToken()).toMatchObject({ kind: TokenKind.Name, value: "foo" });
  });

  it("should skip commas as whitespace", () => {
    const lexer = new Lexer("foo, bar");
    expect(lexer.nextToken()).toMatchObject({ value: "foo" });
    expect(lexer.nextToken()).toMatchObject({ value: "bar" });
  });
});

// ─── Parser Tests ─────────────────────────────────────────────────────────

describe("Parser", () => {
  it("should parse simple query", () => {
    const doc = parse("{ user { name } }");
    expect(doc.kind).toBe(NodeKind.Document);
    expect(doc.definitions).toHaveLength(1);
    const op = doc.definitions[0];
    expect(op.kind).toBe(NodeKind.OperationDefinition);
  });

  it("should parse named query with variables", () => {
    const doc = parse("query GetUser($id: ID!) { user(id: $id) { name email } }");
    const op = doc.definitions[0] as { kind: string; operation: string; name: { value: string }; variableDefinitions: unknown[] };
    expect(op.operation).toBe(OperationType.Query);
    expect(op.name.value).toBe("GetUser");
    expect(op.variableDefinitions).toHaveLength(1);
  });

  it("should parse mutation", () => {
    const doc = parse('mutation CreateUser($name: String!) { createUser(name: $name) { id } }');
    const op = doc.definitions[0] as { operation: string };
    expect(op.operation).toBe(OperationType.Mutation);
  });

  it("should parse subscription", () => {
    const doc = parse("subscription { messageAdded { text } }");
    const op = doc.definitions[0] as { operation: string };
    expect(op.operation).toBe(OperationType.Subscription);
  });

  it("should parse fragment definitions and spreads", () => {
    const doc = parse(`
      fragment UserFields on User { name email }
      query { user { ...UserFields } }
    `);
    expect(doc.definitions).toHaveLength(2);
    expect(doc.definitions[0].kind).toBe(NodeKind.FragmentDefinition);
    expect(doc.definitions[1].kind).toBe(NodeKind.OperationDefinition);
  });

  it("should parse inline fragments", () => {
    const doc = parse("{ node { ... on User { name } ... on Post { title } } }");
    expect(doc.definitions).toHaveLength(1);
  });

  it("should parse field aliases", () => {
    const doc = parse("{ myUser: user { name } }");
    const op = doc.definitions[0] as { selectionSet: { selections: Array<{ alias?: { value: string }; name: { value: string } }> } };
    const field = op.selectionSet.selections[0];
    expect(field.alias?.value).toBe("myUser");
    expect(field.name.value).toBe("user");
  });

  it("should parse directives", () => {
    const doc = parse("{ user @skip(if: true) { name } }");
    const op = doc.definitions[0] as { selectionSet: { selections: Array<{ directives: Array<{ name: { value: string } }> }> } };
    expect(op.selectionSet.selections[0].directives[0].name.value).toBe("skip");
  });

  it("should parse various value types", () => {
    const doc = parse('{ field(a: 42, b: 3.14, c: "hello", d: true, e: null, f: ENUM_VAL, g: [1, 2], h: {key: "val"}) }');
    expect(doc.definitions).toHaveLength(1);
  });

  it("should throw on syntax errors", () => {
    expect(() => parse("{ field(")).toThrow(GraphQLSyntaxError);
  });

  // SDL parsing
  it("should parse scalar type definition", () => {
    const doc = parse("scalar DateTime");
    expect(doc.definitions[0].kind).toBe(NodeKind.ScalarTypeDefinition);
  });

  it("should parse object type definition", () => {
    const doc = parse("type User { id: ID! name: String age: Int }");
    const typeDef = doc.definitions[0] as { kind: string; name: { value: string }; fields: unknown[] };
    expect(typeDef.kind).toBe(NodeKind.ObjectTypeDefinition);
    expect(typeDef.name.value).toBe("User");
    expect(typeDef.fields).toHaveLength(3);
  });

  it("should parse interface definition", () => {
    const doc = parse("interface Node { id: ID! }");
    expect(doc.definitions[0].kind).toBe(NodeKind.InterfaceTypeDefinition);
  });

  it("should parse union definition", () => {
    const doc = parse("union SearchResult = User | Post");
    const u = doc.definitions[0] as { kind: string; types: Array<{ name: { value: string } }> };
    expect(u.kind).toBe(NodeKind.UnionTypeDefinition);
    expect(u.types).toHaveLength(2);
  });

  it("should parse enum definition", () => {
    const doc = parse("enum Status { ACTIVE INACTIVE }");
    const e = doc.definitions[0] as { kind: string; values: unknown[] };
    expect(e.kind).toBe(NodeKind.EnumTypeDefinition);
    expect(e.values).toHaveLength(2);
  });

  it("should parse input type definition", () => {
    const doc = parse("input CreateUserInput { name: String! email: String }");
    expect(doc.definitions[0].kind).toBe(NodeKind.InputObjectTypeDefinition);
  });

  it("should parse type with implements", () => {
    const doc = parse("type User implements Node { id: ID! }");
    const typeDef = doc.definitions[0] as { interfaces: Array<{ name: { value: string } }> };
    expect(typeDef.interfaces[0].name.value).toBe("Node");
  });

  it("should parse schema definition", () => {
    const doc = parse("schema { query: Query mutation: Mutation }");
    expect(doc.definitions[0].kind).toBe(NodeKind.SchemaDefinition);
  });

  it("should parse field arguments in SDL", () => {
    const doc = parse("type Query { user(id: ID!): User }");
    const typeDef = doc.definitions[0] as { fields: Array<{ arguments: unknown[] }> };
    expect(typeDef.fields[0].arguments).toHaveLength(1);
  });
});

// ─── Schema Tests ─────────────────────────────────────────────────────────

describe("Schema", () => {
  it("should build schema from SDL", () => {
    const schema = buildSchema(`
      type Query {
        hello: String
      }
    `);
    expect(schema.queryType).toBeDefined();
    expect(schema.queryType!.name).toBe("Query");
    expect(schema.queryType!.fields.has("hello")).toBe(true);
  });

  it("should include built-in scalars", () => {
    const schema = buildSchema("type Query { x: String }");
    expect(schema.getType("String")).toBeDefined();
    expect(schema.getType("Int")).toBeDefined();
    expect(schema.getType("Float")).toBeDefined();
    expect(schema.getType("Boolean")).toBeDefined();
    expect(schema.getType("ID")).toBeDefined();
  });

  it("should build schema with mutation type", () => {
    const schema = buildSchema(`
      type Query { hello: String }
      type Mutation { setHello(msg: String): String }
    `);
    expect(schema.mutationType).toBeDefined();
    expect(schema.mutationType!.fields.has("setHello")).toBe(true);
  });

  it("should handle custom schema definition", () => {
    const schema = buildSchema(`
      schema { query: Root }
      type Root { hello: String }
    `);
    expect(schema.queryType!.name).toBe("Root");
  });

  it("should build enum types", () => {
    const schema = buildSchema(`
      type Query { status: Status }
      enum Status { ACTIVE INACTIVE }
    `);
    const statusType = schema.getType("Status");
    expect(statusType?.kind).toBe("ENUM");
  });

  it("should build union types", () => {
    const schema = buildSchema(`
      type Query { search: SearchResult }
      union SearchResult = User | Post
      type User { name: String }
      type Post { title: String }
    `);
    const unionType = schema.getType("SearchResult");
    expect(unionType?.kind).toBe("UNION");
  });

  it("should build interface types", () => {
    const schema = buildSchema(`
      type Query { node: Node }
      interface Node { id: ID! }
      type User implements Node { id: ID! name: String }
    `);
    const iface = schema.getType("Node");
    expect(iface?.kind).toBe("INTERFACE");
  });

  it("should build input types", () => {
    const schema = buildSchema(`
      type Query { x: String }
      input CreateInput { name: String! }
    `);
    const input = schema.getType("CreateInput");
    expect(input?.kind).toBe("INPUT_OBJECT");
  });

  it("should throw on duplicate types", () => {
    expect(() => buildSchema(`
      type Query { x: String }
      type Query { y: String }
    `)).toThrow(SchemaError);
  });

  it("should create custom scalar types", () => {
    const dateScalar = createScalarType({
      name: "DateTime",
      serialize: (v) => v instanceof Date ? v.toISOString() : v,
      parseValue: (v) => new Date(v as string),
      parseLiteral: () => undefined,
    });
    expect(dateScalar.kind).toBe("SCALAR");
    expect(dateScalar.name).toBe("DateTime");
  });

  it("should validate schema", () => {
    const schema = buildSchema(`
      type Query { node: Node }
      interface Node { id: ID! }
      type User implements Node { name: String }
    `);
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("missing field"))).toBe(true);
  });
});

// ─── Built-in Scalars Tests ───────────────────────────────────────────────

describe("Built-in Scalars", () => {
  it("should serialize String", () => {
    expect(GraphQLString.serialize(42)).toBe("42");
    expect(GraphQLString.serialize("hello")).toBe("hello");
  });

  it("should serialize Int", () => {
    expect(GraphQLInt.serialize(42)).toBe(42);
    expect(GraphQLInt.serialize(3.14)).toBeNull();
    expect(GraphQLInt.serialize(2147483648)).toBeNull();
  });

  it("should serialize Float", () => {
    expect(GraphQLFloat.serialize(3.14)).toBe(3.14);
    expect(GraphQLFloat.serialize(Infinity)).toBeNull();
  });

  it("should serialize Boolean", () => {
    expect(GraphQLBoolean.serialize(true)).toBe(true);
    expect(GraphQLBoolean.serialize(0)).toBe(false);
  });

  it("should serialize ID", () => {
    expect(GraphQLID.serialize(123)).toBe("123");
    expect(GraphQLID.serialize("abc")).toBe("abc");
  });

  it("should have all built-in scalars in registry", () => {
    expect(BUILT_IN_SCALARS.size).toBe(5);
    expect(BUILT_IN_SCALARS.has("String")).toBe(true);
    expect(BUILT_IN_SCALARS.has("Int")).toBe(true);
  });
});

// ─── Executor Tests ───────────────────────────────────────────────────────

describe("Executor", () => {
  let schema: GraphQLSchema;

  beforeEach(() => {
    schema = buildSchema(`
      type Query {
        hello: String
        user(id: ID!): User
        numbers: [Int]
      }
      type User {
        id: ID!
        name: String
        email: String
      }
    `);
    applyResolvers(schema, {
      Query: {
        hello: () => "world",
        user: (_: unknown, args: Record<string, unknown>) => ({
          id: args.id,
          name: "Alice",
          email: "alice@example.com",
        }),
        numbers: () => [1, 2, 3],
      },
    });
  });

  it("should execute simple query", async () => {
    const result = await execute({
      schema,
      document: parse("{ hello }"),
    });
    expect(result.data).toEqual({ hello: "world" });
    expect(result.errors).toBeUndefined();
  });

  it("should execute query with arguments", async () => {
    const result = await execute({
      schema,
      document: parse('{ user(id: "1") { id name } }'),
    });
    expect(result.data).toEqual({
      user: { id: "1", name: "Alice" },
    });
  });

  it("should execute query with variables", async () => {
    const result = await execute({
      schema,
      document: parse("query GetUser($id: ID!) { user(id: $id) { name } }"),
      variableValues: { id: "42" },
    });
    expect(result.data).toEqual({ user: { name: "Alice" } });
  });

  it("should resolve list fields", async () => {
    const result = await execute({
      schema,
      document: parse("{ numbers }"),
    });
    expect(result.data).toEqual({ numbers: [1, 2, 3] });
  });

  it("should resolve __typename", async () => {
    const result = await execute({
      schema,
      document: parse('{ user(id: "1") { __typename name } }'),
    });
    expect(result.data).toEqual({
      user: { __typename: "User", name: "Alice" },
    });
  });

  it("should handle aliases", async () => {
    const result = await execute({
      schema,
      document: parse("{ greeting: hello }"),
    });
    expect(result.data).toEqual({ greeting: "world" });
  });

  it("should return error for missing operation", async () => {
    const result = await execute({
      schema,
      document: { kind: NodeKind.Document, definitions: [] } as DocumentNode,
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toContain("Must provide an operation");
  });

  it("should handle @skip directive", async () => {
    const result = await execute({
      schema,
      document: parse("{ hello @skip(if: true) }"),
    });
    expect(result.data).toEqual({});
  });

  it("should handle @include directive", async () => {
    const result = await execute({
      schema,
      document: parse("{ hello @include(if: false) }"),
    });
    expect(result.data).toEqual({});
  });

  it("should enforce max depth", async () => {
    const result = await execute({
      schema,
      document: parse('{ user(id: "1") { name } }'),
      maxDepth: 0,
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toContain("depth");
  });

  it("should enforce max complexity", async () => {
    const result = await execute({
      schema,
      document: parse('{ hello user(id: "1") { id name email } numbers }'),
      maxComplexity: 2,
    });
    expect(result.errors).toBeDefined();
    expect(result.errors![0].message).toContain("complexity");
  });

  it("should handle resolver errors gracefully", async () => {
    applyResolvers(schema, {
      Query: {
        hello: () => { throw new Error("resolver failed"); },
      },
    });
    const result = await execute({
      schema,
      document: parse("{ hello }"),
    });
    expect(result.errors).toBeDefined();
    expect(result.data!.hello).toBeNull();
  });
});

// ─── Validation Tests ─────────────────────────────────────────────────────

describe("Validation", () => {
  let schema: GraphQLSchema;

  beforeEach(() => {
    schema = buildSchema(`
      type Query {
        user(id: ID!): User
        hello: String
      }
      type User {
        id: ID!
        name: String
      }
    `);
  });

  it("should pass valid queries", () => {
    const doc = parse("{ hello }");
    const errors = validate(schema, doc);
    expect(errors).toHaveLength(0);
  });

  it("should detect unknown fields", () => {
    const doc = parse("{ unknownField }");
    const errors = validate(schema, doc);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("unknownField");
  });

  it("should detect unknown arguments", () => {
    const doc = parse('{ user(unknownArg: "x") { name } }');
    const errors = validate(schema, doc);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("unknownArg");
  });

  it("should detect unused variables", () => {
    const doc = parse("query Q($id: ID!) { hello }");
    const errors = validate(schema, doc);
    expect(errors.some(e => e.message.includes("$id"))).toBe(true);
  });

  it("should detect duplicate operation names", () => {
    const doc = parse("query Q { hello } query Q { hello }");
    const errors = validate(schema, doc);
    expect(errors.some(e => e.message.includes("Duplicate operation"))).toBe(true);
  });

  it("should detect unknown fragments", () => {
    const doc = parse("{ ...UnknownFrag }");
    const errors = validate(schema, doc);
    expect(errors.some(e => e.message.includes("UnknownFrag"))).toBe(true);
  });

  it("should detect unused fragments", () => {
    const doc = parse(`
      fragment F on User { name }
      query { hello }
    `);
    const errors = validate(schema, doc);
    expect(errors.some(e => e.message.includes("not used"))).toBe(true);
  });

  it("should require selection set on object fields", () => {
    const doc = parse('{ user(id: "1") }');
    const errors = validate(schema, doc);
    expect(errors.some(e => e.message.includes("selection set"))).toBe(true);
  });
});

// ─── Subscription / PubSub Tests ──────────────────────────────────────────

describe("PubSub", () => {
  let pubsub: PubSub;

  beforeEach(() => {
    pubsub = new PubSub();
  });

  it("should publish and receive events", async () => {
    const iter = pubsub.subscribe<string>("test");
    await pubsub.publish("test", "hello");
    const result = await iter.next();
    expect(result.value).toBe("hello");
    expect(result.done).toBe(false);
  });

  it("should buffer events when no consumer is waiting", async () => {
    const iter = pubsub.subscribe<number>("num");
    await pubsub.publish("num", 1);
    await pubsub.publish("num", 2);
    expect((await iter.next()).value).toBe(1);
    expect((await iter.next()).value).toBe(2);
  });

  it("should support subscription filtering", async () => {
    const iter = pubsub.subscribe<number>("num", {
      filter: (payload) => payload > 5,
    });
    await pubsub.publish("num", 3);
    await pubsub.publish("num", 10);
    const result = await iter.next();
    expect(result.value).toBe(10);
  });

  it("should track subscriber count", () => {
    expect(pubsub.subscriberCount("test")).toBe(0);
    const iter = pubsub.subscribe("test");
    expect(pubsub.subscriberCount("test")).toBe(1);
    expect(pubsub.hasSubscribers("test")).toBe(true);
    iter.return!();
  });

  it("should unsubscribe via return()", async () => {
    const iter = pubsub.subscribe("test");
    expect(pubsub.subscriberCount("test")).toBe(1);
    await iter.return!();
    expect(pubsub.subscriberCount("test")).toBe(0);
  });

  it("should unsubscribe by ID", () => {
    const iter = pubsub.subscribe("test");
    expect(pubsub.subscriberCount("test")).toBe(1);
    pubsub.unsubscribe(iter.id);
    expect(pubsub.subscriberCount("test")).toBe(0);
  });

  it("should clear all subscriptions", () => {
    pubsub.subscribe("a");
    pubsub.subscribe("b");
    pubsub.clear();
    expect(pubsub.hasSubscribers("a")).toBe(false);
    expect(pubsub.hasSubscribers("b")).toBe(false);
  });

  it("should be async iterable", () => {
    const iter = pubsub.subscribe("test");
    expect(iter[Symbol.asyncIterator]).toBeDefined();
    expect(iter[Symbol.asyncIterator]()).toBe(iter);
    iter.return!();
  });
});

describe("ConnectionManager", () => {
  it("should manage connections", () => {
    const pubsub = new PubSub();
    const manager = new ConnectionManager(pubsub);

    const iter = pubsub.subscribe("test");
    manager.add("conn1", "test", iter.id);

    expect(manager.size).toBe(1);
    expect(manager.get("conn1")).toBeDefined();
    expect(manager.getAll()).toHaveLength(1);

    manager.remove("conn1");
    expect(manager.size).toBe(0);
  });

  it("should close all connections", () => {
    const pubsub = new PubSub();
    const manager = new ConnectionManager(pubsub);
    const iter1 = pubsub.subscribe("a");
    const iter2 = pubsub.subscribe("b");
    manager.add("c1", "a", iter1.id);
    manager.add("c2", "b", iter2.id);
    manager.closeAll();
    expect(manager.size).toBe(0);
  });
});

describe("withFilter", () => {
  it("should filter async iterator values", async () => {
    const pubsub = new PubSub();
    const iter = pubsub.subscribe<number>("num");
    const filtered = withFilter(iter, (n) => n > 5);

    await pubsub.publish("num", 2);
    await pubsub.publish("num", 8);
    const result = await filtered.next();
    expect(result.value).toBe(8);
    await filtered.return!();
  });
});

// ─── HTTP Handler Tests ───────────────────────────────────────────────────

describe("HTTP Handler", () => {
  let handler: (req: HttpRequest) => Promise<import("../src/http-handler.js").HttpResponse>;

  beforeEach(() => {
    const schema = buildSchema("type Query { hello: String }");
    applyResolvers(schema, { Query: { hello: () => "world" } });
    handler = createHttpHandler({ schema, graphiql: true });
  });

  it("should handle POST JSON query", async () => {
    const res = await handler({
      method: "POST",
      url: "/graphql",
      headers: { "content-type": "application/json" },
      body: { query: "{ hello }" },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.hello).toBe("world");
  });

  it("should handle GET query", async () => {
    const res = await handler({
      method: "GET",
      url: "/graphql?query={hello}",
      headers: {},
      query: { query: "{ hello }" },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.hello).toBe("world");
  });

  it("should serve GraphiQL page", async () => {
    const res = await handler({
      method: "GET",
      url: "/graphql",
      headers: { accept: "text/html" },
    });
    expect(res.status).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.body).toContain("GraphiQL");
  });

  it("should handle missing query", async () => {
    const res = await handler({
      method: "POST",
      url: "/graphql",
      headers: { "content-type": "application/json" },
      body: {},
    });
    const body = JSON.parse(res.body);
    expect(body.errors).toBeDefined();
  });

  it("should handle batched queries", async () => {
    const res = await handler({
      method: "POST",
      url: "/graphql",
      headers: { "content-type": "application/json" },
      body: [
        { query: "{ hello }" },
        { query: "{ hello }" },
      ],
    });
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("should reject unsupported methods", async () => {
    const res = await handler({
      method: "DELETE",
      url: "/graphql",
      headers: {},
    });
    expect(res.status).toBe(400);
  });
});

describe("GraphiQL HTML", () => {
  it("should generate GraphiQL HTML", () => {
    const html = getGraphiQLHtml("/api/graphql");
    expect(html).toContain("GraphiQL");
    expect(html).toContain("/api/graphql");
  });
});

// ─── Error Tests ──────────────────────────────────────────────────────────

describe("Errors", () => {
  it("should create GraphQLError with locations and path", () => {
    const err = new GraphQLError("test", {
      locations: [{ line: 1, column: 5 }],
      path: ["user", "name"],
    });
    expect(err.message).toBe("test");
    expect(err.locations).toHaveLength(1);
    expect(err.path).toEqual(["user", "name"]);
  });

  it("should serialize to JSON", () => {
    const err = new GraphQLError("test", {
      locations: [{ line: 1, column: 1 }],
      extensions: { code: "TEST" },
    });
    const json = err.toJSON();
    expect(json.message).toBe("test");
    expect(json.locations).toHaveLength(1);
    expect(json.extensions?.code).toBe("TEST");
  });

  it("should format mixed errors", () => {
    const errors = formatErrors([
      new GraphQLError("gql error"),
      new Error("regular error"),
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toBe("gql error");
    expect(errors[1].message).toBe("regular error");
  });

  it("should create syntax error with location", () => {
    const err = new GraphQLSyntaxError("Unexpected", { line: 1, column: 5 });
    expect(err.locations).toHaveLength(1);
    expect(err.extensions.code).toBe("GRAPHQL_PARSE_FAILED");
  });

  it("should create validation error", () => {
    const err = new GraphQLValidationError("Invalid field");
    expect(err.extensions.code).toBe("GRAPHQL_VALIDATION_FAILED");
  });

  it("should create execution error with path", () => {
    const err = new GraphQLExecutionError("Failed", ["user", "name"]);
    expect(err.path).toEqual(["user", "name"]);
  });

  it("should create schema error", () => {
    const err = new SchemaError("Bad schema", "SCHEMA_BUILD_ERROR");
    expect(err.code).toBe("SCHEMA_BUILD_ERROR");
  });
});

// ─── TypeRegistry Tests ───────────────────────────────────────────────────

describe("TypeRegistry", () => {
  it("should start with built-in scalars", () => {
    const registry = new TypeRegistry();
    expect(registry.has("String")).toBe(true);
    expect(registry.has("Int")).toBe(true);
    expect(registry.has("Float")).toBe(true);
    expect(registry.has("Boolean")).toBe(true);
    expect(registry.has("ID")).toBe(true);
  });

  it("should register and retrieve types", () => {
    const registry = new TypeRegistry();
    registry.register({
      kind: "OBJECT",
      name: "User",
      fields: new Map(),
      interfaces: [],
    });
    expect(registry.has("User")).toBe(true);
    expect(registry.get("User")?.kind).toBe("OBJECT");
  });

  it("should reject duplicate non-builtin types", () => {
    const registry = new TypeRegistry();
    registry.register({ kind: "OBJECT", name: "Foo", fields: new Map(), interfaces: [] });
    expect(() =>
      registry.register({ kind: "OBJECT", name: "Foo", fields: new Map(), interfaces: [] }),
    ).toThrow(SchemaError);
  });
});

// ─── Depth/Complexity Tests ───────────────────────────────────────────────

describe("Depth & Complexity", () => {
  it("should calculate query depth", () => {
    const doc = parse("{ user { posts { comments { text } } } }");
    const op = doc.definitions[0] as { selectionSet: { selections: readonly import("../src/types.js").SelectionNode[] } };
    const depth = calculateDepth(op.selectionSet.selections, new Map());
    expect(depth).toBe(3);
  });

  it("should calculate query complexity", () => {
    const doc = parse("{ a b c { d e } }");
    const op = doc.definitions[0] as { selectionSet: { selections: readonly import("../src/types.js").SelectionNode[] } };
    const complexity = calculateComplexity(op.selectionSet.selections, new Map());
    expect(complexity).toBe(5);
  });
});

// ─── GraphQL Module Tests ─────────────────────────────────────────────────

describe("GraphQLModule", () => {
  it("should create module with forRoot", () => {
    const config = GraphQLModule.forRoot({
      typeDefs: "type Query { hello: String }",
      resolvers: { Query: { hello: () => "world" } },
    });
    expect(config.module).toBe(GraphQLModule);
    expect(config.providers).toHaveLength(2);
  });

  it("should initialize and handle requests", async () => {
    const mod = new GraphQLModule({
      typeDefs: "type Query { hello: String }",
      resolvers: { Query: { hello: () => "world" } },
    });
    const res = await mod.handleRequest({
      method: "POST",
      url: "/graphql",
      headers: { "content-type": "application/json" },
      body: { query: "{ hello }" },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.hello).toBe("world");
  });

  it("should return configured path", () => {
    const mod = new GraphQLModule({ path: "/api/gql" });
    expect(mod.getPath()).toBe("/api/gql");
  });

  it("should throw without typeDefs", () => {
    const mod = new GraphQLModule();
    expect(() => mod.initialize()).toThrow("typeDefs");
  });
});

// ─── Resolver Decorator Tests ─────────────────────────────────────────────

describe("Resolver Decorators", () => {
  it("should build resolver map from decorated class", () => {
    class UserResolver {
      getUsers() {
        return [{ id: "1", name: "Alice" }];
      }
      create() {
        return { id: "2", name: "Bob" };
      }
      fullName() {
        return "Full Name";
      }
    }
    // Apply decorators manually
    Resolver("User")(UserResolver);
    Query("users")(UserResolver.prototype, "getUsers", Object.getOwnPropertyDescriptor(UserResolver.prototype, "getUsers")!);
    Mutation("createUser")(UserResolver.prototype, "create", Object.getOwnPropertyDescriptor(UserResolver.prototype, "create")!);
    Field()(UserResolver.prototype, "fullName", Object.getOwnPropertyDescriptor(UserResolver.prototype, "fullName")!);

    const instance = new UserResolver();
    const map = buildResolverMap([instance]);

    expect(map["Query"]).toBeDefined();
    expect(map["Query"]["users"]).toBeDefined();
    expect(map["Mutation"]).toBeDefined();
    expect(map["Mutation"]["createUser"]).toBeDefined();
    expect(map["User"]).toBeDefined();
    expect(map["User"]["fullName"]).toBeDefined();
  });

  it("should resolve with Arg decorator applied manually", () => {
    class TestResolver {
      greet(name: string) {
        return `Hello ${name}`;
      }
    }
    // Apply decorators manually (no parameter decorator syntax)
    Resolver()(TestResolver);
    Query("greet")(TestResolver.prototype, "greet", Object.getOwnPropertyDescriptor(TestResolver.prototype, "greet")!);
    Arg("name")(TestResolver.prototype, "greet", 0);

    const instance = new TestResolver();
    const map = buildResolverMap([instance]);
    const result = (map["Query"]["greet"] as (...args: unknown[]) => unknown)(
      null,
      { name: "World" },
      {},
      {},
    );
    expect(result).toBe("Hello World");
  });

  it("should inject context with Ctx decorator applied manually", () => {
    class TestResolver {
      test(ctx: { userId: string }) {
        return ctx.userId;
      }
    }
    Resolver()(TestResolver);
    Query("test")(TestResolver.prototype, "test", Object.getOwnPropertyDescriptor(TestResolver.prototype, "test")!);
    Ctx()(TestResolver.prototype, "test", 0);

    const instance = new TestResolver();
    const map = buildResolverMap([instance]);
    const result = (map["Query"]["test"] as (...args: unknown[]) => unknown)(
      null,
      {},
      { userId: "123" },
      {},
    );
    expect(result).toBe("123");
  });

  it("should get resolver metadata", () => {
    class PostResolver {
      posts() {
        return [];
      }
    }
    Resolver("Post")(PostResolver);
    Query()(PostResolver.prototype, "posts", Object.getOwnPropertyDescriptor(PostResolver.prototype, "posts")!);

    const meta = getResolverMetadata(PostResolver);
    expect(meta).toBeDefined();
    expect(meta!.typeName).toBe("Post");
    expect(meta!.queries.has("posts")).toBe(true);
  });
});
