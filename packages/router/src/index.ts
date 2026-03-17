// @nexus/router - Type-safe routing with path parameters and guards
export { Router } from "./router.js";
export { RouteTrie } from "./trie.js";
export { Route, normalizePath, joinPaths } from "./route.js";
export { RouteGroup } from "./route-group.js";
export type { RouteGroupApi, RouteGroupOptions } from "./route-group.js";
export { createGuard, composeGuards, guardMiddleware } from "./guard.js";
export {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Head,
  Options,
  Param,
  Query,
  Body,
  Headers,
  UseGuard,
  UseMiddleware,
  getControllerMetadata,
  getRouteMethodsMetadata,
} from "./decorators.js";
export { RouterModule, ROUTER_TOKEN } from "./router-module.js";
export type { RouterModuleOptions } from "./router-module.js";
export { RouteNotFoundError, MethodNotAllowedError } from "./errors.js";
export type {
  HandlerFunction,
  HttpMethod,
  RouteDefinition,
  RouteMatch,
  RouterOptions,
  GuardFunction,
  Guard,
  ControllerMetadata,
  RouteMethodMetadata,
  ParamDecoratorMetadata,
  NexusRequestLike,
  NexusResponseLike,
  NextFunction,
} from "./types.js";
