// @nexus/openapi - OpenAPI specification auto-generation

// Types
export type {
  OpenApiSpec,
  InfoObject,
  ContactObject,
  LicenseObject,
  ServerObject,
  PathItemObject,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  HeaderObject,
  MediaTypeObject,
  ExampleObject,
  SchemaObject,
  ComponentsObject,
  SecuritySchemeObject,
  OAuthFlowsObject,
  OAuthFlowObject,
  SecurityRequirementObject,
  TagObject,
  ApiOperationMeta,
  ApiParamMeta,
  ApiBodyMeta,
  ApiResponseMeta,
  ApiSecurityMeta,
  EndpointMetadata,
  OpenApiModuleOptions,
} from "./types.js";

// Generator
export { generateSpec, convertPathParams, extractPathParams } from "./generator.js";
export type { RouteInfo, GenerateSpecOptions } from "./generator.js";

// Decorators
export {
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
} from "./decorators.js";

// Schema Converter
export {
  typeToSchema,
  objectSchema,
  arraySchema,
  oneOfSchema,
  anyOfSchema,
  allOfSchema,
  enumSchema,
  refSchema,
  nullable,
} from "./schema-converter.js";

// Spec Builder
export { OpenApiBuilder } from "./spec-builder.js";

// Swagger UI
export { getSwaggerUIHtml } from "./swagger-ui.js";
export type { SwaggerUIOptions } from "./swagger-ui.js";

// Validator
export { validateSpec, assertValidSpec } from "./validator.js";

// Module
export { OpenApiModule, OPENAPI_SPEC_TOKEN, OPENAPI_OPTIONS_TOKEN } from "./openapi-module.js";

// Errors
export { OpenApiError, SpecValidationError } from "./errors.js";
