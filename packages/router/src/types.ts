// @nexus/router - Type definitions

// Local interfaces mirroring @nexus/http to avoid build-order dependency
export interface NexusRequestLike {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly ip: string;
  readonly cookies: Record<string, string>;
  params: Record<string, string>;
  body(): Promise<unknown>;
  get(header: string): string | undefined;
}

export interface NexusResponseLike {
  readonly headersSent: boolean;
  readonly statusCode: number;
  status(code: number): NexusResponseLike;
  header(name: string, value: string | string[]): NexusResponseLike;
  json(data: unknown): void;
  text(data: string): void;
  html(data: string): void;
  redirect(url: string, statusCode?: number): void;
  send(data: unknown): void;
  end(): void;
}

export type NextFunction = (error?: Error) => void;

export type HandlerFunction = (
  req: NexusRequestLike,
  res: NexusResponseLike,
  next: NextFunction,
) => void | Promise<void>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "ALL";

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlers: HandlerFunction[];
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface RouteMatch {
  handlers: HandlerFunction[];
  params: Record<string, string>;
  route: RouteDefinition;
}

export interface RouterOptions {
  prefix?: string;
  caseSensitive?: boolean;
}

export interface TrieNode {
  segment: string;
  children: Map<string, TrieNode>;
  paramChild: TrieNode | undefined;
  wildcardChild: TrieNode | undefined;
  paramName: string | undefined;
  wildcardName: string | undefined;
  paramPattern: RegExp | undefined;
  isOptional: boolean;
  routes: Map<HttpMethod, RouteDefinition>;
}

export interface GuardFunction {
  (req: NexusRequestLike): boolean | Promise<boolean>;
}

export interface Guard {
  canActivate(req: NexusRequestLike): boolean | Promise<boolean>;
}

export interface ControllerMetadata {
  prefix: string;
  routes: RouteMethodMetadata[];
  guards: GuardFunction[];
  middlewares: HandlerFunction[];
}

export interface RouteMethodMetadata {
  method: HttpMethod;
  path: string;
  propertyKey: string;
  guards: GuardFunction[];
  middlewares: HandlerFunction[];
  paramDecorators: ParamDecoratorMetadata[];
}

export interface ParamDecoratorMetadata {
  index: number;
  type: "param" | "query" | "body" | "headers";
  name?: string;
}
