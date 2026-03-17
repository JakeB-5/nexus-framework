// @nexus/security - Input sanitization utilities

import type { SanitizeOptions } from "./types.js";

/**
 * HTML entity map for encoding
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

const HTML_ENTITY_PATTERN = /[&<>"'`/]/g;

/**
 * Encode HTML entities to prevent XSS
 */
export function encodeHtml(input: string): string {
  return input.replace(HTML_ENTITY_PATTERN, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Strip all HTML tags from input
 */
export function stripTags(input: string, allowedTags: string[] = []): string {
  if (allowedTags.length === 0) {
    return input.replace(/<[^>]*>/g, "");
  }

  const allowedPattern = allowedTags.map((tag) => tag.toLowerCase()).join("|");
  const regex = new RegExp(`<(?!\\/?(${allowedPattern})\\b)[^>]*>`, "gi");
  return input.replace(regex, "");
}

/**
 * Escape characters that could be used in SQL injection.
 * NOTE: This is NOT a substitute for parameterized queries.
 * Use only as an additional layer of defense.
 */
export function escapeSqlChars(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\x00/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

/**
 * Prevent path traversal by removing dangerous path segments
 */
export function sanitizePath(input: string): string {
  return input
    .replace(/\\/g, "/")
    .replace(/\.{2,}/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\//, "")
    .replace(/\/$/, "");
}

/**
 * Check if a path contains traversal attempts
 */
export function hasPathTraversal(input: string): boolean {
  const normalized = input.replace(/\\/g, "/");
  return normalized.includes("..") || normalized.includes("//") || /^\//.test(normalized);
}

/**
 * Sanitize a string with configurable options
 */
export function sanitize(input: string, options: SanitizeOptions = {}): string {
  let result = input;

  // Strip HTML tags
  result = stripTags(result, options.allowedTags);

  // Encode remaining HTML entities
  result = encodeHtml(result);

  // Enforce max length
  if (options.maxLength && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }

  return result;
}

/**
 * Sanitize all string values in an object (shallow)
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: SanitizeOptions = {},
): T {
  const result = { ...obj };

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitize(value, options);
    }
  }

  return result;
}
