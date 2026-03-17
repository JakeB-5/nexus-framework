// @nexus/openapi - OpenAPI spec generator from route metadata

import { getEndpointMetadata } from "./decorators.js";
import type {
  EndpointMetadata,
  OpenApiSpec,
  OperationObject,
  ParameterObject,
  ResponseObject,
  ServerObject,
  TagObject,
} from "./types.js";

export interface RouteInfo {
  method: string;
  path: string;
  handler: object;
  handlerMethod: string;
  controllerClass?: object;
}

export interface GenerateSpecOptions {
  title?: string;
  version?: string;
  description?: string;
  servers?: ServerObject[];
  routes: RouteInfo[];
  tags?: TagObject[];
}

/**
 * Generate an OpenAPI 3.1 spec from route metadata
 */
export function generateSpec(options: GenerateSpecOptions): OpenApiSpec {
  const spec: OpenApiSpec = {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "API",
      version: options.version ?? "1.0.0",
    },
    paths: {},
  };

  if (options.description) {
    spec.info.description = options.description;
  }

  if (options.servers && options.servers.length > 0) {
    spec.servers = options.servers;
  }

  if (options.tags && options.tags.length > 0) {
    spec.tags = options.tags;
  }

  for (const route of options.routes) {
    const endpointMeta = getRouteEndpointMeta(route);

    if (endpointMeta?.excluded) {
      continue;
    }

    const operation = buildOperation(route, endpointMeta);
    const openApiPath = convertPathParams(route.path);
    const method = route.method.toLowerCase();

    if (!spec.paths[openApiPath]) {
      spec.paths[openApiPath] = {};
    }

    (spec.paths[openApiPath] as Record<string, OperationObject>)[method] = operation;
  }

  return spec;
}

function getRouteEndpointMeta(route: RouteInfo): EndpointMetadata | undefined {
  const target = route.controllerClass ?? route.handler;
  const allMeta = getEndpointMetadata(target);
  if (!allMeta) return undefined;
  return allMeta.get(route.handlerMethod);
}

function buildOperation(route: RouteInfo, meta?: EndpointMetadata): OperationObject {
  const operation: OperationObject = {
    responses: {},
  };

  // Set summary/description from decorator
  if (meta?.operation) {
    operation.summary = meta.operation.summary;
    if (meta.operation.description) {
      operation.description = meta.operation.description;
    }
    if (meta.operation.operationId) {
      operation.operationId = meta.operation.operationId;
    }
    if (meta.operation.deprecated) {
      operation.deprecated = true;
    }
  }

  // Tags
  const tags: string[] = [];
  if (meta?.tags && meta.tags.length > 0) {
    tags.push(...meta.tags);
  }
  // Check for class-level tags
  const target = route.controllerClass ?? route.handler;
  const allMeta = getEndpointMetadata(target);
  const classMeta = allMeta?.get("__class__");
  if (classMeta?.tags && classMeta.tags.length > 0) {
    tags.push(...classMeta.tags);
  }
  if (tags.length > 0) {
    operation.tags = [...new Set(tags)];
  }

  // Parameters
  const params: ParameterObject[] = [];

  // Extract path parameters from route
  const pathParams = extractPathParams(route.path);
  for (const paramName of pathParams) {
    const paramMeta = meta?.params.find((p) => p.name === paramName && p.in === "path");
    params.push({
      name: paramName,
      in: "path",
      required: true,
      schema: paramMeta?.schema ?? { type: "string" },
      description: paramMeta?.description,
    });
  }

  // Add query and header parameters from decorators
  if (meta) {
    for (const param of meta.params) {
      if (param.in !== "path") {
        params.push({
          name: param.name,
          in: param.in,
          required: param.required,
          schema: param.schema ?? { type: "string" },
          description: param.description,
        });
      }
    }
    for (const header of meta.headers) {
      params.push({
        name: header.name,
        in: "header",
        required: header.required,
        schema: header.schema ?? { type: "string" },
        description: header.description,
      });
    }
  }

  if (params.length > 0) {
    operation.parameters = params;
  }

  // Request body
  if (meta?.body) {
    const contentType = meta.body.contentType ?? "application/json";
    operation.requestBody = {
      description: meta.body.description,
      required: meta.body.required ?? true,
      content: {
        [contentType]: { schema: meta.body.schema },
      },
    };
  }

  // Responses
  if (meta?.responses && meta.responses.length > 0) {
    for (const resp of meta.responses) {
      const statusKey = String(resp.status);
      const response: ResponseObject = {
        description: resp.description,
      };
      if (resp.schema) {
        const ct = resp.contentType ?? "application/json";
        response.content = {
          [ct]: { schema: resp.schema },
        };
      }
      operation.responses[statusKey] = response;
    }
  } else {
    // Default response
    operation.responses["200"] = { description: "Successful response" };
  }

  // Security
  if (meta?.security && meta.security.length > 0) {
    operation.security = meta.security.map((s) => {
      const schemeName = s.type === "bearer" ? "BearerAuth" : s.type === "basic" ? "BasicAuth" : s.name ?? "ApiKeyAuth";
      return { [schemeName]: [] };
    });
  }

  return operation;
}

/**
 * Convert Express-style path params to OpenAPI style
 * e.g. /users/:id -> /users/{id}
 */
export function convertPathParams(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

/**
 * Extract parameter names from a path
 */
export function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  return params;
}
