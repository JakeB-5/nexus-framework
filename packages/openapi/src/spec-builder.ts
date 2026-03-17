// @nexus/openapi - Fluent OpenAPI spec builder

import type {
  ComponentsObject,
  InfoObject,
  OpenApiSpec,
  OperationObject,
  PathItemObject,
  SchemaObject,
  SecuritySchemeObject,
  ServerObject,
  TagObject,
} from "./types.js";

/**
 * Fluent builder for OpenAPI 3.1 specifications
 */
export class OpenApiBuilder {
  private spec: OpenApiSpec;

  constructor() {
    this.spec = {
      openapi: "3.1.0",
      info: { title: "API", version: "1.0.0" },
      paths: {},
    };
  }

  /**
   * Set API info
   */
  info(title: string, version: string, description?: string): this {
    this.spec.info = { title, version };
    if (description) {
      this.spec.info.description = description;
    }
    return this;
  }

  /**
   * Set full info object
   */
  infoObject(info: InfoObject): this {
    this.spec.info = info;
    return this;
  }

  /**
   * Add a server
   */
  server(url: string, description?: string): this {
    if (!this.spec.servers) {
      this.spec.servers = [];
    }
    const server: ServerObject = { url };
    if (description) {
      server.description = description;
    }
    this.spec.servers.push(server);
    return this;
  }

  /**
   * Add a path with operations
   */
  path(path: string, operations: PathItemObject): this {
    this.spec.paths[path] = {
      ...this.spec.paths[path],
      ...operations,
    };
    return this;
  }

  /**
   * Add a GET operation to a path
   */
  get(path: string, operation: OperationObject): this {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }
    this.spec.paths[path].get = operation;
    return this;
  }

  /**
   * Add a POST operation to a path
   */
  post(path: string, operation: OperationObject): this {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }
    this.spec.paths[path].post = operation;
    return this;
  }

  /**
   * Add a PUT operation to a path
   */
  put(path: string, operation: OperationObject): this {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }
    this.spec.paths[path].put = operation;
    return this;
  }

  /**
   * Add a DELETE operation to a path
   */
  delete(path: string, operation: OperationObject): this {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }
    this.spec.paths[path].delete = operation;
    return this;
  }

  /**
   * Add a PATCH operation to a path
   */
  patch(path: string, operation: OperationObject): this {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }
    this.spec.paths[path].patch = operation;
    return this;
  }

  /**
   * Add a component schema
   */
  component(name: string, schema: SchemaObject): this {
    if (!this.spec.components) {
      this.spec.components = {};
    }
    if (!this.spec.components.schemas) {
      this.spec.components.schemas = {};
    }
    this.spec.components.schemas[name] = schema;
    return this;
  }

  /**
   * Add a security scheme
   */
  securityScheme(name: string, scheme: SecuritySchemeObject): this {
    if (!this.spec.components) {
      this.spec.components = {};
    }
    if (!this.spec.components.securitySchemes) {
      this.spec.components.securitySchemes = {};
    }
    this.spec.components.securitySchemes[name] = scheme;
    return this;
  }

  /**
   * Add a tag
   */
  tag(name: string, description?: string): this {
    if (!this.spec.tags) {
      this.spec.tags = [];
    }
    const tagObj: TagObject = { name };
    if (description) {
      tagObj.description = description;
    }
    this.spec.tags.push(tagObj);
    return this;
  }

  /**
   * Set components object directly
   */
  components(components: ComponentsObject): this {
    this.spec.components = { ...this.spec.components, ...components };
    return this;
  }

  /**
   * Build and return the complete spec
   */
  build(): OpenApiSpec {
    return structuredClone(this.spec);
  }

  /**
   * Build and return as JSON string
   */
  toJSON(pretty = true): string {
    return JSON.stringify(this.spec, null, pretty ? 2 : undefined);
  }
}
