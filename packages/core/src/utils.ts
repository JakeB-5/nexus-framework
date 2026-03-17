// @nexus/core - Internal utilities

import type { Constructor, Token } from "./types.js";

/**
 * Get a human-readable name for a token
 */
export function getTokenName(token: Token): string {
  if (typeof token === "string") {
    return token;
  }
  if (typeof token === "symbol") {
    return token.toString();
  }
  if (typeof token === "function") {
    return token.name || "AnonymousClass";
  }
  return String(token);
}

/**
 * Get class name from a constructor or instance
 */
export function getClassName(target: Constructor | object): string {
  if (typeof target === "function") {
    return target.name || "AnonymousClass";
  }
  return target.constructor.name || "AnonymousClass";
}

/**
 * Check if a value is a constructor function (a class)
 */
export function isConstructor(value: unknown): value is Constructor {
  if (typeof value !== "function") {
    return false;
  }
  try {
    // Classes have a prototype with a constructor property pointing back to themselves
    return (
      value.prototype !== undefined &&
      value.prototype.constructor === value
    );
  } catch {
    return false;
  }
}

/**
 * Create a unique token from a description string
 */
export function createToken<T = unknown>(description: string): Token<T> {
  return Symbol(description) as Token<T>;
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns sorted array or throws if a cycle is detected.
 *
 * @param nodes - All node identifiers
 * @param edges - Map of node → set of nodes it depends on (prerequisites)
 * @returns Sorted array (dependencies come before dependents)
 */
export function topologicalSort<T>(
  nodes: Iterable<T>,
  edges: Map<T, Set<T>>,
): T[] {
  // Build adjacency list and in-degree map
  const inDegree = new Map<T, number>();
  const adjacency = new Map<T, Set<T>>();

  for (const node of nodes) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
    if (!adjacency.has(node)) {
      adjacency.set(node, new Set());
    }
  }

  // For each node, process its dependencies
  for (const [node, deps] of edges) {
    for (const dep of deps) {
      // dep → node (dep must come before node)
      if (!adjacency.has(dep)) {
        adjacency.set(dep, new Set());
      }
      adjacency.get(dep)!.add(node);
      inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
    }
  }

  // Start with nodes that have no dependencies
  const queue: T[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const sorted: T[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  if (sorted.length !== inDegree.size) {
    // Find cycle for error reporting
    const remaining = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([node]) => node);
    const cycleNodes = remaining.map((n) =>
      typeof n === "string"
        ? n
        : typeof n === "function"
          ? (n as Constructor).name
          : String(n),
    );
    throw new Error(
      `Cycle detected among: ${cycleNodes.join(", ")}`,
    );
  }

  return sorted;
}

/**
 * Deep merge two objects. Arrays are replaced, not merged.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Check if a value is a plain object (not an array, date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Generate a short unique ID for internal tracking
 */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Normalize a token to a consistent string key for map lookups
 */
export function tokenToString(token: Token): string {
  if (typeof token === "string") {
    return `str:${token}`;
  }
  if (typeof token === "symbol") {
    return `sym:${token.toString()}`;
  }
  return `cls:${token.name || "anonymous"}`;
}
