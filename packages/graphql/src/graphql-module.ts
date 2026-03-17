// @nexus/graphql - Module integration

import type { GraphQLModuleOptions, GraphQLSchema } from "./types.js";
import { buildSchema } from "./schema.js";
import { applyResolvers } from "./resolver.js";
import { createHttpHandler, type HttpRequest, type HttpResponse } from "./http-handler.js";

// ─── Module Tokens ────────────────────────────────────────────────────────

export const GRAPHQL_SCHEMA_TOKEN = Symbol.for("nexus:graphql:schema");
export const GRAPHQL_OPTIONS_TOKEN = Symbol.for("nexus:graphql:options");

// ─── GraphQL Module ───────────────────────────────────────────────────────

export class GraphQLModule {
  private schema: GraphQLSchema | undefined;
  private handler: ((req: HttpRequest) => Promise<HttpResponse>) | undefined;
  private readonly options: GraphQLModuleOptions;

  constructor(options: GraphQLModuleOptions = {}) {
    this.options = {
      path: "/graphql",
      graphiql: true,
      ...options,
    };
  }

  /**
   * Initialize the GraphQL module with type definitions and resolvers
   */
  initialize(): void {
    if (!this.options.typeDefs) {
      throw new Error("GraphQL module requires typeDefs");
    }

    this.schema = buildSchema(this.options.typeDefs);

    if (this.options.resolvers) {
      applyResolvers(this.schema, this.options.resolvers);
    }

    this.handler = createHttpHandler({
      schema: this.schema,
      context: this.options.context,
      graphiql: this.options.graphiql,
      maxBatchSize: 10,
    });
  }

  /**
   * Get the built schema
   */
  getSchema(): GraphQLSchema | undefined {
    return this.schema;
  }

  /**
   * Get the configured path
   */
  getPath(): string {
    return this.options.path ?? "/graphql";
  }

  /**
   * Handle an HTTP request
   */
  async handleRequest(req: HttpRequest): Promise<HttpResponse> {
    if (!this.handler) {
      this.initialize();
    }
    return this.handler!(req);
  }

  /**
   * Static factory for creating module configuration
   */
  static forRoot(options: GraphQLModuleOptions): {
    module: typeof GraphQLModule;
    providers: Array<{ provide: symbol; useValue: unknown }>;
  } {
    const instance = new GraphQLModule(options);
    return {
      module: GraphQLModule,
      providers: [
        { provide: GRAPHQL_OPTIONS_TOKEN, useValue: options },
        { provide: GRAPHQL_SCHEMA_TOKEN, useValue: instance },
      ],
    };
  }
}
