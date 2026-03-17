// @nexus/router - Route decorators
import type {
  ControllerMetadata,
  GuardFunction,
  HandlerFunction,
  HttpMethod,
  ParamDecoratorMetadata,
  RouteMethodMetadata,
} from "./types.js";

const CONTROLLER_META = Symbol.for("nexus:controller");
const ROUTE_META = Symbol.for("nexus:route:methods");

// Use symbol-keyed properties for metadata storage (no reflect-metadata dependency)
type AnyTarget = Record<string | symbol, unknown>;

export function getControllerMetadata(target: object): ControllerMetadata | undefined {
  return (target as AnyTarget)[CONTROLLER_META] as ControllerMetadata | undefined;
}

export function getRouteMethodsMetadata(target: object): RouteMethodMetadata[] {
  return ((target as AnyTarget)[ROUTE_META] as RouteMethodMetadata[] | undefined) ?? [];
}

function setControllerMeta(target: object, meta: ControllerMetadata): void {
  (target as AnyTarget)[CONTROLLER_META] = meta;
}

function getOrCreateRouteMethods(target: object): RouteMethodMetadata[] {
  let methods = (target as AnyTarget)[ROUTE_META] as RouteMethodMetadata[] | undefined;
  if (!methods) {
    methods = [];
    (target as AnyTarget)[ROUTE_META] = methods;
  }
  return methods;
}

function getOrCreateParamDecorators(target: object, propertyKey: string): ParamDecoratorMetadata[] {
  const key = `__param__${propertyKey}`;
  let params = (target as AnyTarget)[key] as ParamDecoratorMetadata[] | undefined;
  if (!params) {
    params = [];
    (target as AnyTarget)[key] = params;
  }
  return params;
}

function getParamDecorators(target: object, propertyKey: string): ParamDecoratorMetadata[] {
  const key = `__param__${propertyKey}`;
  return ((target as AnyTarget)[key] as ParamDecoratorMetadata[] | undefined) ?? [];
}

export function Controller(prefix = "/"): (target: new (...args: unknown[]) => unknown) => void {
  return (target) => {
    const methods = getRouteMethodsMetadata(target.prototype as object);
    const meta: ControllerMetadata = {
      prefix,
      routes: methods,
      guards: [],
      middlewares: [],
    };
    setControllerMeta(target, meta);
  };
}

function createMethodDecorator(method: HttpMethod) {
  return (path = "/"): (target: object, propertyKey: string, _descriptor: PropertyDescriptor) => void => {
    return (target: object, propertyKey: string, _descriptor: PropertyDescriptor) => {
      const methods = getOrCreateRouteMethods(target);
      const paramDecorators = getParamDecorators(target, propertyKey);
      const guardKey = `__guard__${propertyKey}`;
      const mwKey = `__mw__${propertyKey}`;
      const guards = ((target as AnyTarget)[guardKey] as GuardFunction[] | undefined) ?? [];
      const middlewares = ((target as AnyTarget)[mwKey] as HandlerFunction[] | undefined) ?? [];

      methods.push({
        method,
        path,
        propertyKey,
        guards,
        middlewares,
        paramDecorators,
      });
    };
  };
}

export const Get = createMethodDecorator("GET");
export const Post = createMethodDecorator("POST");
export const Put = createMethodDecorator("PUT");
export const Patch = createMethodDecorator("PATCH");
export const Delete = createMethodDecorator("DELETE");
export const Head = createMethodDecorator("HEAD");
export const Options = createMethodDecorator("OPTIONS");

function createParamDecorator(type: ParamDecoratorMetadata["type"], name?: string) {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    const params = getOrCreateParamDecorators(target, propertyKey);
    params.push({ index: parameterIndex, type, name });
  };
}

export function Param(name: string) {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    createParamDecorator("param", name)(target, propertyKey, parameterIndex);
  };
}

export function Query(name: string) {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    createParamDecorator("query", name)(target, propertyKey, parameterIndex);
  };
}

export function Body() {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    createParamDecorator("body")(target, propertyKey, parameterIndex);
  };
}

export function Headers(name: string) {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    createParamDecorator("headers", name)(target, propertyKey, parameterIndex);
  };
}

export function UseGuard(...guards: GuardFunction[]) {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const key = `__guard__${propertyKey}`;
    (target as AnyTarget)[key] = guards;
  };
}

export function UseMiddleware(...middlewares: HandlerFunction[]) {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const key = `__mw__${propertyKey}`;
    (target as AnyTarget)[key] = middlewares;
  };
}
