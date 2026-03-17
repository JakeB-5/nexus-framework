// @nexus/openapi - OpenAPI 3.1 type definitions

export interface OpenApiSpec {
  openapi: string;
  info: InfoObject;
  servers?: ServerObject[];
  paths: Record<string, PathItemObject>;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
}

export interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  trace?: OperationObject;
  summary?: string;
  description?: string;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: SecurityRequirementObject[];
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
}

export interface HeaderObject {
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  $ref?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  example?: unknown;
  readOnly?: boolean;
  writeOnly?: boolean;
  additionalProperties?: boolean | SchemaObject;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  securitySchemes?: Record<string, SecuritySchemeObject>;
  parameters?: Record<string, ParameterObject>;
  requestBodies?: Record<string, RequestBodyObject>;
  responses?: Record<string, ResponseObject>;
  headers?: Record<string, HeaderObject>;
}

export interface SecuritySchemeObject {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
}

export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export type SecurityRequirementObject = Record<string, string[]>;

export interface TagObject {
  name: string;
  description?: string;
}

// ─── Decorator Metadata Types ─────────────────────────────────────────────

export interface ApiOperationMeta {
  summary: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
}

export interface ApiParamMeta {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

export interface ApiBodyMeta {
  schema: SchemaObject;
  description?: string;
  required?: boolean;
  contentType?: string;
}

export interface ApiResponseMeta {
  status: number | string;
  description: string;
  schema?: SchemaObject;
  contentType?: string;
}

export interface ApiSecurityMeta {
  type: "bearer" | "basic" | "apiKey";
  name?: string;
  in?: "query" | "header" | "cookie";
}

export interface EndpointMetadata {
  operation?: ApiOperationMeta;
  params: ApiParamMeta[];
  body?: ApiBodyMeta;
  responses: ApiResponseMeta[];
  tags: string[];
  security: ApiSecurityMeta[];
  headers: ApiParamMeta[];
  excluded: boolean;
}

// ─── Module Types ─────────────────────────────────────────────────────────

export interface OpenApiModuleOptions {
  title?: string;
  version?: string;
  description?: string;
  docsPath?: string;
  specPath?: string;
  servers?: ServerObject[];
}
