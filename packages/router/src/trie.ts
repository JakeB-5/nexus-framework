// @nexus/router - Trie-based path matching
import type { HttpMethod, RouteDefinition, RouteMatch, TrieNode } from "./types.js";

function createNode(segment: string): TrieNode {
  return {
    segment,
    children: new Map(),
    paramChild: undefined,
    wildcardChild: undefined,
    paramName: undefined,
    wildcardName: undefined,
    paramPattern: undefined,
    isOptional: false,
    routes: new Map(),
  };
}

export class RouteTrie {
  private readonly root: TrieNode;
  private readonly _caseSensitive: boolean;

  constructor(caseSensitive = false) {
    this.root = createNode("");
    this._caseSensitive = caseSensitive;
  }

  insert(definition: RouteDefinition): void {
    const segments = this._splitPath(definition.path);
    let node = this.root;

    for (const segment of segments) {
      node = this._insertSegment(node, segment);
    }

    node.routes.set(definition.method, definition);
  }

  match(method: HttpMethod | string, path: string): RouteMatch | undefined {
    const segments = this._splitPath(path);
    const params: Record<string, string> = {};
    const upperMethod = method.toUpperCase() as HttpMethod;

    const node = this._matchSegments(this.root, segments, 0, params);
    if (!node) {
      return undefined;
    }

    // Try exact method first, then ALL
    const route = node.routes.get(upperMethod) ?? node.routes.get("ALL");
    if (!route) {
      return undefined;
    }

    return {
      handlers: route.handlers,
      params: { ...params },
      route,
    };
  }

  getAllowedMethods(path: string): HttpMethod[] {
    const segments = this._splitPath(path);
    const params: Record<string, string> = {};
    const node = this._matchSegments(this.root, segments, 0, params);

    if (!node) {
      return [];
    }

    return Array.from(node.routes.keys());
  }

  private _splitPath(path: string): string[] {
    const normalized = path.replace(/\/+/g, "/").replace(/\/$/, "");
    if (normalized === "" || normalized === "/") {
      return [];
    }
    const withoutLeading = normalized.startsWith("/") ? normalized.slice(1) : normalized;
    return withoutLeading.split("/");
  }

  private _insertSegment(parent: TrieNode, segment: string): TrieNode {
    // Wildcard: *name
    if (segment.startsWith("*")) {
      const name = segment.slice(1) || "wildcard";
      if (!parent.wildcardChild) {
        parent.wildcardChild = createNode(segment);
        parent.wildcardName = name;
      }
      return parent.wildcardChild;
    }

    // Parameter: :name or :name? or :name(\d+)
    if (segment.startsWith(":")) {
      const { name, pattern, optional } = this._parseParam(segment);
      if (!parent.paramChild) {
        parent.paramChild = createNode(segment);
        parent.paramName = name;
        parent.paramChild.paramPattern = pattern;
        parent.paramChild.isOptional = optional;
      }
      return parent.paramChild;
    }

    // Static segment
    const key = this._caseSensitive ? segment : segment.toLowerCase();
    let child = parent.children.get(key);
    if (!child) {
      child = createNode(segment);
      parent.children.set(key, child);
    }
    return child;
  }

  private _parseParam(segment: string): { name: string; pattern: RegExp | undefined; optional: boolean } {
    let raw = segment.slice(1); // Remove ':'
    let optional = false;
    let pattern: RegExp | undefined;

    // Check for regex constraint: :id(\d+)
    const parenIdx = raw.indexOf("(");
    if (parenIdx !== -1) {
      const regexStr = raw.slice(parenIdx + 1, -1); // Remove parens
      pattern = new RegExp(`^${regexStr}$`);
      raw = raw.slice(0, parenIdx);
    }

    // Check for optional: :id?
    if (raw.endsWith("?")) {
      optional = true;
      raw = raw.slice(0, -1);
    }

    return { name: raw, pattern, optional };
  }

  private _matchSegments(
    node: TrieNode,
    segments: string[],
    index: number,
    params: Record<string, string>,
  ): TrieNode | undefined {
    // Base case: consumed all segments
    if (index >= segments.length) {
      // Check if this node has routes
      if (node.routes.size > 0) {
        return node;
      }
      // Check optional param child
      if (node.paramChild?.isOptional && node.paramChild.routes.size > 0) {
        return node.paramChild;
      }
      return node.routes.size > 0 ? node : undefined;
    }

    const segment = segments[index]!;
    const key = this._caseSensitive ? segment : segment.toLowerCase();

    // Priority 1: Static match
    const staticChild = node.children.get(key);
    if (staticChild) {
      const result = this._matchSegments(staticChild, segments, index + 1, params);
      if (result) {
        return result;
      }
    }

    // Priority 2: Parameter match
    if (node.paramChild && node.paramName) {
      const paramNode = node.paramChild;
      // Check regex constraint
      if (!paramNode.paramPattern || paramNode.paramPattern.test(segment)) {
        const prevValue = params[node.paramName];
        params[node.paramName] = decodeURIComponent(segment);
        const result = this._matchSegments(paramNode, segments, index + 1, params);
        if (result) {
          return result;
        }
        // Backtrack
        if (prevValue !== undefined) {
          params[node.paramName] = prevValue;
        } else {
          delete params[node.paramName];
        }
      }
    }

    // Priority 3: Wildcard match (consumes remaining segments)
    if (node.wildcardChild && node.wildcardName) {
      const remaining = segments.slice(index).map(decodeURIComponent).join("/");
      params[node.wildcardName] = remaining;
      return node.wildcardChild;
    }

    return undefined;
  }
}
