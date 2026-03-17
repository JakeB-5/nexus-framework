// @nexus/graphql - HTTP integration for GraphQL

import { execute } from "./executor.js";
import { parse } from "./parser.js";
import { validate } from "./validation.js";
import type {
  ExecutionResult,
  GraphQLHTTPOptions,
  GraphQLHTTPRequest,
  GraphQLSchema,
} from "./types.js";

// ─── GraphQL HTTP Handler ─────────────────────────────────────────────────

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Create a GraphQL HTTP request handler
 */
export function createHttpHandler(options: GraphQLHTTPOptions): (req: HttpRequest) => Promise<HttpResponse> {
  const {
    schema,
    rootValue,
    context,
    graphiql = false,
    persistedQueries,
    maxBatchSize = 10,
  } = options;

  return async (req: HttpRequest): Promise<HttpResponse> => {
    // GraphiQL page
    if (graphiql && req.method === "GET" && acceptsHtml(req.headers.accept)) {
      return {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: getGraphiQLHtml(),
      };
    }

    try {
      const graphqlRequest = await parseHttpRequest(req);

      // Batched queries
      if (Array.isArray(graphqlRequest)) {
        if (graphqlRequest.length > maxBatchSize) {
          return jsonResponse(400, {
            errors: [{ message: `Batch size ${graphqlRequest.length} exceeds maximum ${maxBatchSize}` }],
          });
        }
        const results = await Promise.all(
          graphqlRequest.map((r) => executeRequest(schema, r, rootValue, context, req, persistedQueries)),
        );
        return jsonResponse(200, results);
      }

      const result = await executeRequest(schema, graphqlRequest, rootValue, context, req, persistedQueries);
      const status = result.data ? 200 : 400;
      return jsonResponse(status, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return jsonResponse(400, { errors: [{ message }] });
    }
  };
}

async function executeRequest(
  schema: GraphQLSchema,
  request: GraphQLHTTPRequest,
  rootValue: unknown,
  context: unknown | ((req: unknown) => unknown | Promise<unknown>) | undefined,
  req: HttpRequest,
  persistedQueries?: Map<string, string>,
): Promise<ExecutionResult> {
  let queryString = request.query;

  // Persisted queries support
  if (!queryString && request.extensions) {
    const hash = (request.extensions as Record<string, unknown>).persistedQuery;
    if (hash && typeof hash === "object") {
      const sha = (hash as Record<string, string>).sha256Hash;
      if (sha && persistedQueries) {
        queryString = persistedQueries.get(sha);
      }
    }
    if (!queryString) {
      return { errors: [{ message: "PersistedQueryNotFound" }] };
    }
  }

  if (!queryString) {
    return { errors: [{ message: "Must provide query string" }] };
  }

  // Parse
  let document;
  try {
    document = parse(queryString);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse error";
    return { errors: [{ message }] };
  }

  // Validate
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return {
      errors: validationErrors.map((e) => ({ message: e.message })),
    };
  }

  // Resolve context
  let contextValue = context;
  if (typeof context === "function") {
    contextValue = await (context as (req: unknown) => unknown | Promise<unknown>)(req);
  }

  // Execute
  return execute({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues: request.variables,
    operationName: request.operationName,
  });
}

async function parseHttpRequest(req: HttpRequest): Promise<GraphQLHTTPRequest | GraphQLHTTPRequest[]> {
  if (req.method === "GET") {
    return parseGetRequest(req);
  }

  if (req.method === "POST") {
    return parsePostRequest(req);
  }

  throw new Error(`Unsupported HTTP method: ${req.method}`);
}

function parseGetRequest(req: HttpRequest): GraphQLHTTPRequest {
  const query = req.query ?? {};
  let variables: Record<string, unknown> | undefined;
  if (query.variables) {
    try {
      variables = JSON.parse(query.variables);
    } catch {
      throw new Error("Variables are invalid JSON");
    }
  }
  return {
    query: query.query,
    operationName: query.operationName,
    variables,
  };
}

function parsePostRequest(req: HttpRequest): GraphQLHTTPRequest | GraphQLHTTPRequest[] {
  const contentType = getContentType(req.headers);

  if (contentType?.includes("application/json")) {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (Array.isArray(body)) {
      return body as GraphQLHTTPRequest[];
    }
    return body as GraphQLHTTPRequest;
  }

  if (contentType?.includes("application/graphql")) {
    return { query: String(req.body) };
  }

  // Default to JSON-like body
  if (req.body && typeof req.body === "object") {
    if (Array.isArray(req.body)) {
      return req.body as GraphQLHTTPRequest[];
    }
    return req.body as GraphQLHTTPRequest;
  }

  throw new Error("Unsupported Content-Type");
}

function getContentType(headers: Record<string, string | string[] | undefined>): string | undefined {
  const ct = headers["content-type"] ?? headers["Content-Type"];
  if (Array.isArray(ct)) return ct[0];
  return ct;
}

function acceptsHtml(accept: string | string[] | undefined): boolean {
  if (!accept) return false;
  const header = Array.isArray(accept) ? accept[0] : accept;
  return header.includes("text/html");
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

// ─── GraphiQL HTML ────────────────────────────────────────────────────────

export function getGraphiQLHtml(endpoint = "/graphql"): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>GraphiQL</title>
  <style>
    body { height: 100vh; margin: 0; overflow: hidden; }
    #graphiql { height: 100vh; }
  </style>
  <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
</head>
<body>
  <div id="graphiql">Loading...</div>
  <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '${endpoint}' });
    ReactDOM.render(
      React.createElement(GraphiQL, { fetcher }),
      document.getElementById('graphiql'),
    );
  </script>
</body>
</html>`;
}
