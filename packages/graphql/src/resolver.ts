// @nexus/graphql - Resolver decorators and utilities

import type {
  ResolverClassMetadata,
  ResolverFn,
  ResolverMap,
} from "./types.js";

// ─── Metadata Storage ─────────────────────────────────────────────────────

const resolverMetadata = new WeakMap<object, ResolverClassMetadata>();

function getOrCreateMetadata(target: object): ResolverClassMetadata {
  let meta = resolverMetadata.get(target);
  if (!meta) {
    meta = {
      queries: new Map(),
      mutations: new Map(),
      subscriptions: new Map(),
      fields: new Map(),
      params: new Map(),
    };
    resolverMetadata.set(target, meta);
  }
  return meta;
}

// ─── Class Decorator ──────────────────────────────────────────────────────

/**
 * Mark a class as a resolver for a specific type
 */
export function Resolver(typeName?: string): (target: new (...args: unknown[]) => unknown) => void {
  return (target: new (...args: unknown[]) => unknown): void => {
    const meta = getOrCreateMetadata(target.prototype);
    meta.typeName = typeName;
  };
}

// ─── Method Decorators ────────────────────────────────────────────────────

/**
 * Mark a method as a Query resolver
 */
export function Query(name?: string): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateMetadata(target);
    meta.queries.set(propertyKey, {
      methodName: propertyKey,
      name: name ?? propertyKey,
    });
  };
}

/**
 * Mark a method as a Mutation resolver
 */
export function Mutation(name?: string): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateMetadata(target);
    meta.mutations.set(propertyKey, {
      methodName: propertyKey,
      name: name ?? propertyKey,
    });
  };
}

/**
 * Mark a method as a Subscription resolver
 */
export function Subscription(name?: string): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateMetadata(target);
    meta.subscriptions.set(propertyKey, {
      methodName: propertyKey,
      name: name ?? propertyKey,
    });
  };
}

/**
 * Mark a method as a field resolver
 */
export function Field(fieldType?: string): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void => {
    const meta = getOrCreateMetadata(target);
    meta.fields.set(propertyKey, {
      methodName: propertyKey,
      fieldType,
    });
  };
}

// ─── Parameter Decorators ─────────────────────────────────────────────────

/**
 * Inject a named argument into a resolver parameter
 */
export function Arg(name: string, type?: string): (target: object, propertyKey: string, parameterIndex: number) => void {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    const meta = getOrCreateMetadata(target);
    let paramMap = meta.params.get(propertyKey);
    if (!paramMap) {
      paramMap = new Map();
      meta.params.set(propertyKey, paramMap);
    }
    paramMap.set(parameterIndex, { kind: "arg", name, type });
  };
}

/**
 * Inject the GraphQL context
 */
export function Ctx(): (target: object, propertyKey: string, parameterIndex: number) => void {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    const meta = getOrCreateMetadata(target);
    let paramMap = meta.params.get(propertyKey);
    if (!paramMap) {
      paramMap = new Map();
      meta.params.set(propertyKey, paramMap);
    }
    paramMap.set(parameterIndex, { kind: "ctx" });
  };
}

/**
 * Inject the ResolveInfo
 */
export function Info(): (target: object, propertyKey: string, parameterIndex: number) => void {
  return (target: object, propertyKey: string, parameterIndex: number): void => {
    const meta = getOrCreateMetadata(target);
    let paramMap = meta.params.get(propertyKey);
    if (!paramMap) {
      paramMap = new Map();
      meta.params.set(propertyKey, paramMap);
    }
    paramMap.set(parameterIndex, { kind: "info" });
  };
}

// ─── Resolver Map Builder ─────────────────────────────────────────────────

/**
 * Build a resolver map from decorated resolver class instances
 */
export function buildResolverMap(resolvers: object[]): ResolverMap {
  const map: ResolverMap = {};

  for (const resolver of resolvers) {
    const proto = Object.getPrototypeOf(resolver) as object;
    const meta = resolverMetadata.get(proto);
    if (!meta) continue;

    const typeName = meta.typeName;

    // Process queries
    for (const [, queryMeta] of meta.queries) {
      if (!map["Query"]) map["Query"] = {};
      map["Query"][queryMeta.name] = createResolverFn(resolver, queryMeta.methodName, meta);
    }

    // Process mutations
    for (const [, mutationMeta] of meta.mutations) {
      if (!map["Mutation"]) map["Mutation"] = {};
      map["Mutation"][mutationMeta.name] = createResolverFn(resolver, mutationMeta.methodName, meta);
    }

    // Process subscriptions
    for (const [, subMeta] of meta.subscriptions) {
      if (!map["Subscription"]) map["Subscription"] = {};
      map["Subscription"][subMeta.name] = createResolverFn(resolver, subMeta.methodName, meta);
    }

    // Process field resolvers
    if (typeName) {
      for (const [, fieldMeta] of meta.fields) {
        if (!map[typeName]) map[typeName] = {};
        map[typeName][fieldMeta.methodName] = createResolverFn(resolver, fieldMeta.methodName, meta);
      }
    }
  }

  return map;
}

function createResolverFn(
  instance: object,
  methodName: string,
  meta: ResolverClassMetadata,
): ResolverFn {
  const paramMeta = meta.params.get(methodName);
  const method = (instance as Record<string, (...args: unknown[]) => unknown>)[methodName];

  return (parent: unknown, args: Record<string, unknown>, context: unknown, info: unknown): unknown => {
    if (!paramMeta || paramMeta.size === 0) {
      return method.call(instance, parent, args, context, info);
    }

    // Build argument list based on parameter decorators
    const maxParam = Math.max(...paramMeta.keys()) + 1;
    const resolvedArgs: unknown[] = new Array(maxParam);

    for (const [index, paramInfo] of paramMeta) {
      switch (paramInfo.kind) {
        case "arg":
          resolvedArgs[index] = paramInfo.name ? args[paramInfo.name] : args;
          break;
        case "ctx":
          resolvedArgs[index] = context;
          break;
        case "info":
          resolvedArgs[index] = info;
          break;
      }
    }

    return method.call(instance, ...resolvedArgs);
  };
}

/**
 * Apply a resolver map to a schema (mutates schema types)
 */
export function applyResolvers(
  schema: { types: Map<string, unknown> },
  resolverMap: ResolverMap,
): void {
  for (const [typeName, fieldResolvers] of Object.entries(resolverMap)) {
    const type = schema.types.get(typeName) as { kind: string; fields?: Map<string, { resolve?: ResolverFn }> } | undefined;
    if (!type || !type.fields) continue;
    if (type.kind === "INPUT_OBJECT" || type.kind === "SCALAR" || type.kind === "ENUM" || type.kind === "UNION") continue;

    for (const [fieldName, resolver] of Object.entries(fieldResolvers)) {
      const field = type.fields.get(fieldName);
      if (field) {
        field.resolve = resolver as ResolverFn;
      }
    }
  }
}

/**
 * Get metadata for a resolver class (useful for testing)
 */
export function getResolverMetadata(target: object): ResolverClassMetadata | undefined {
  const proto = typeof target === "function" ? target.prototype : Object.getPrototypeOf(target);
  return resolverMetadata.get(proto as object);
}
