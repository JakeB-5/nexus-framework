// @nexus/openapi - API documentation decorators

import type {
  ApiParamMeta,
  EndpointMetadata,
  SchemaObject,
} from "./types.js";

// ─── Metadata Storage ─────────────────────────────────────────────────────

const endpointMetadata = new WeakMap<object, Map<string, EndpointMetadata>>();

function getOrCreateEndpointMeta(target: object, propertyKey: string): EndpointMetadata {
  let classMap = endpointMetadata.get(target);
  if (!classMap) {
    classMap = new Map();
    endpointMetadata.set(target, classMap);
  }
  let meta = classMap.get(propertyKey);
  if (!meta) {
    meta = {
      params: [],
      responses: [],
      tags: [],
      security: [],
      headers: [],
      excluded: false,
    };
    classMap.set(propertyKey, meta);
  }
  return meta;
}

/**
 * Get all endpoint metadata for a class
 */
export function getEndpointMetadata(target: object): Map<string, EndpointMetadata> | undefined {
  const proto = typeof target === "function" ? target.prototype : target;
  return endpointMetadata.get(proto as object);
}

// ─── Decorators ───────────────────────────────────────────────────────────

/**
 * Describe an API operation
 */
export function ApiOperation(summary: string, description?: string): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.operation = { summary, description };
  };
}

/**
 * Document a path parameter
 */
export function ApiParam(name: string, options?: Omit<ApiParamMeta, "name" | "in">): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.params.push({
      name,
      in: "path",
      required: true,
      ...options,
    });
  };
}

/**
 * Document a query parameter
 */
export function ApiQuery(name: string, options?: Omit<ApiParamMeta, "name" | "in">): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.params.push({
      name,
      in: "query",
      ...options,
    });
  };
}

/**
 * Document the request body
 */
export function ApiBody(schema: SchemaObject, options?: { description?: string; required?: boolean; contentType?: string }): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.body = {
      schema,
      description: options?.description,
      required: options?.required ?? true,
      contentType: options?.contentType,
    };
  };
}

/**
 * Document a response
 */
export function ApiResponse(status: number | string, schema?: SchemaObject, description?: string): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.responses.push({
      status,
      description: description ?? `Response ${status}`,
      schema,
    });
  };
}

/**
 * Group endpoints by tags
 */
export function ApiTags(...tags: string[]): (target: object, propertyKey?: string, descriptor?: PropertyDescriptor) => void {
  return (target: object, propertyKey?: string, _descriptor?: PropertyDescriptor): void => {
    if (propertyKey) {
      // Method decorator
      const meta = getOrCreateEndpointMeta(target, propertyKey);
      meta.tags.push(...tags);
    } else {
      // Class decorator - apply to all existing methods
      const classTarget = typeof target === "function" ? target.prototype : target;
      let classMap = endpointMetadata.get(classTarget as object);
      if (!classMap) {
        classMap = new Map();
        endpointMetadata.set(classTarget as object, classMap);
      }
      // Store class-level tags separately
      const classMeta = getOrCreateEndpointMeta(classTarget as object, "__class__");
      classMeta.tags.push(...tags);
    }
  };
}

/**
 * Add Bearer auth security requirement
 */
export function ApiBearerAuth(): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.security.push({ type: "bearer" });
  };
}

/**
 * Add Basic auth security requirement
 */
export function ApiBasicAuth(): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.security.push({ type: "basic" });
  };
}

/**
 * Add API Key security requirement
 */
export function ApiKeyAuth(name?: string, location?: "query" | "header" | "cookie"): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.security.push({ type: "apiKey", name, in: location });
  };
}

/**
 * Document a header parameter
 */
export function ApiHeader(name: string, options?: { description?: string; required?: boolean; schema?: SchemaObject }): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.headers.push({
      name,
      in: "header",
      ...options,
    });
  };
}

/**
 * Exclude endpoint from API docs
 */
export function ApiExclude(): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateEndpointMeta(target, propertyKey);
    meta.excluded = true;
  };
}
