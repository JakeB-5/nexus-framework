// @nexus/openapi - Module integration

import { getSwaggerUIHtml } from "./swagger-ui.js";
import type { OpenApiModuleOptions, OpenApiSpec } from "./types.js";

// ─── Module Tokens ────────────────────────────────────────────────────────

export const OPENAPI_SPEC_TOKEN = Symbol.for("nexus:openapi:spec");
export const OPENAPI_OPTIONS_TOKEN = Symbol.for("nexus:openapi:options");

// ─── OpenAPI Module ───────────────────────────────────────────────────────

export class OpenApiModule {
  private spec: OpenApiSpec | undefined;
  private readonly options: Required<OpenApiModuleOptions>;

  constructor(options: OpenApiModuleOptions = {}) {
    this.options = {
      title: options.title ?? "API",
      version: options.version ?? "1.0.0",
      description: options.description ?? "",
      docsPath: options.docsPath ?? "/docs",
      specPath: options.specPath ?? "/openapi.json",
      servers: options.servers ?? [],
    };
  }

  /**
   * Set the OpenAPI spec directly
   */
  setSpec(spec: OpenApiSpec): void {
    this.spec = spec;
  }

  /**
   * Get the current spec
   */
  getSpec(): OpenApiSpec | undefined {
    return this.spec;
  }

  /**
   * Get the spec as JSON string
   */
  getSpecJson(): string {
    if (!this.spec) {
      return JSON.stringify({
        openapi: "3.1.0",
        info: { title: this.options.title, version: this.options.version },
        paths: {},
      });
    }
    return JSON.stringify(this.spec);
  }

  /**
   * Get Swagger UI HTML
   */
  getDocsHtml(): string {
    return getSwaggerUIHtml({
      title: this.options.title,
      specUrl: this.options.specPath,
    });
  }

  /**
   * Get configured docs path
   */
  getDocsPath(): string {
    return this.options.docsPath;
  }

  /**
   * Get configured spec path
   */
  getSpecPath(): string {
    return this.options.specPath;
  }

  /**
   * Handle incoming request for docs or spec
   */
  handleRequest(path: string): { status: number; contentType: string; body: string } | undefined {
    if (path === this.options.docsPath) {
      return {
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: this.getDocsHtml(),
      };
    }
    if (path === this.options.specPath) {
      return {
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: this.getSpecJson(),
      };
    }
    return undefined;
  }

  /**
   * Static factory for creating module configuration
   */
  static forRoot(options: OpenApiModuleOptions): {
    module: typeof OpenApiModule;
    providers: Array<{ provide: symbol; useValue: unknown }>;
  } {
    const instance = new OpenApiModule(options);
    return {
      module: OpenApiModule,
      providers: [
        { provide: OPENAPI_OPTIONS_TOKEN, useValue: options },
        { provide: OPENAPI_SPEC_TOKEN, useValue: instance },
      ],
    };
  }
}
