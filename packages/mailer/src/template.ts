// Simple mustache-like template engine

import { TemplateError } from "./errors.js";
import type { TemplateData } from "./types.js";

type CompiledNode =
  | { type: "text"; value: string }
  | { type: "variable"; key: string; escaped: boolean }
  | { type: "section"; key: string; inverted: boolean; children: CompiledNode[] };

const templateCache = new Map<string, CompiledNode[]>();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNestedValue(data: TemplateData, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return !!value;
}

function parse(template: string): CompiledNode[] {
  const nodes: CompiledNode[] = [];
  let pos = 0;

  while (pos < template.length) {
    const tripleStart = template.indexOf("{{{", pos);
    const doubleStart = template.indexOf("{{", pos);

    // Check for triple mustache first (unescaped)
    if (tripleStart !== -1 && (doubleStart === -1 || tripleStart <= doubleStart)) {
      if (tripleStart > pos) {
        nodes.push({ type: "text", value: template.slice(pos, tripleStart) });
      }

      const end = template.indexOf("}}}", tripleStart + 3);
      if (end === -1) {
        throw new TemplateError("Unclosed triple mustache tag");
      }

      const key = template.slice(tripleStart + 3, end).trim();
      nodes.push({ type: "variable", key, escaped: false });
      pos = end + 3;
      continue;
    }

    if (doubleStart === -1) {
      nodes.push({ type: "text", value: template.slice(pos) });
      break;
    }

    if (doubleStart > pos) {
      nodes.push({ type: "text", value: template.slice(pos, doubleStart) });
    }

    const end = template.indexOf("}}", doubleStart + 2);
    if (end === -1) {
      throw new TemplateError("Unclosed mustache tag");
    }

    const tag = template.slice(doubleStart + 2, end).trim();
    pos = end + 2;

    if (tag.startsWith("#if ")) {
      // Conditional section: {{#if key}}...{{/if}}
      const key = tag.slice(4).trim();
      const closeTag = "{{/if}}";
      const closeIdx = findClosingTag(template, pos, "if");
      if (closeIdx === -1) {
        throw new TemplateError(`Unclosed {{#if ${key}}}`);
      }

      // Check for {{else}}
      const elseIdx = findElseTag(template, pos, closeIdx);
      let innerTemplate: string;
      let elseTemplate: string | undefined;

      if (elseIdx !== -1) {
        innerTemplate = template.slice(pos, elseIdx);
        elseTemplate = template.slice(elseIdx + 8, closeIdx); // 8 = "{{else}}".length
      } else {
        innerTemplate = template.slice(pos, closeIdx);
      }

      const children = parse(innerTemplate);
      const section: CompiledNode = {
        type: "section",
        key,
        inverted: false,
        children,
      };
      nodes.push(section);

      if (elseTemplate) {
        const elseChildren = parse(elseTemplate);
        nodes.push({
          type: "section",
          key,
          inverted: true,
          children: elseChildren,
        });
      }

      pos = closeIdx + closeTag.length;
    } else if (tag.startsWith("#each ")) {
      // Loop section: {{#each items}}...{{/each}}
      const key = tag.slice(6).trim();
      const closeTag = "{{/each}}";
      const closeIdx = findClosingTag(template, pos, "each");
      if (closeIdx === -1) {
        throw new TemplateError(`Unclosed {{#each ${key}}}`);
      }

      const innerTemplate = template.slice(pos, closeIdx);
      const children = parse(innerTemplate);

      nodes.push({
        type: "section",
        key: `each:${key}`,
        inverted: false,
        children,
      });

      pos = closeIdx + closeTag.length;
    } else {
      // Variable
      nodes.push({ type: "variable", key: tag, escaped: true });
    }
  }

  return nodes;
}

function findClosingTag(
  template: string,
  startPos: number,
  tagName: string,
): number {
  const closeTag = `{{/${tagName}}}`;
  const openTag = `{{#${tagName} `;
  let depth = 1;
  let pos = startPos;

  while (pos < template.length && depth > 0) {
    const nextOpen = template.indexOf(openTag, pos);
    const nextClose = template.indexOf(closeTag, pos);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) {
        return nextClose;
      }
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

function findElseTag(
  template: string,
  startPos: number,
  endPos: number,
): number {
  // Simple search for {{else}} between start and end, respecting nesting
  const elseTag = "{{else}}";
  let depth = 0;
  let pos = startPos;

  while (pos < endPos) {
    if (template.startsWith("{{#", pos)) {
      depth++;
    } else if (template.startsWith("{{/", pos)) {
      depth--;
    } else if (depth === 0 && template.startsWith(elseTag, pos)) {
      return pos;
    }
    pos++;
  }

  return -1;
}

function render(nodes: CompiledNode[], data: TemplateData): string {
  let result = "";

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        result += node.value;
        break;

      case "variable": {
        const value = getNestedValue(data, node.key);
        const str = value === undefined || value === null ? "" : String(value);
        result += node.escaped ? escapeHtml(str) : str;
        break;
      }

      case "section": {
        if (node.key.startsWith("each:")) {
          // Loop
          const arrayKey = node.key.slice(5);
          const value = getNestedValue(data, arrayKey);
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              const item = value[i];
              const itemData: TemplateData =
                typeof item === "object" && item !== null
                  ? { ...data, ...(item as TemplateData), "@index": i, "@first": i === 0, "@last": i === value.length - 1 }
                  : { ...data, ".": item, "@index": i, "@first": i === 0, "@last": i === value.length - 1 };
              result += render(node.children, itemData);
            }
          }
        } else if (node.inverted) {
          // Else section
          const value = getNestedValue(data, node.key);
          if (!isTruthy(value)) {
            result += render(node.children, data);
          }
        } else {
          // If section
          const value = getNestedValue(data, node.key);
          if (isTruthy(value)) {
            result += render(node.children, data);
          }
        }
        break;
      }
    }
  }

  return result;
}

export function compile(template: string): (data: TemplateData) => string {
  const cached = templateCache.get(template);
  if (cached) {
    return (data: TemplateData) => render(cached, data);
  }

  const nodes = parse(template);
  templateCache.set(template, nodes);
  return (data: TemplateData) => render(nodes, data);
}

export function renderTemplate(
  template: string,
  data: TemplateData,
): string {
  const fn = compile(template);
  return fn(data);
}

export function clearTemplateCache(): void {
  templateCache.clear();
}
