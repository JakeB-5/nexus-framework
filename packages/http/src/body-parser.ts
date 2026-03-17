// @nexus/http - Request body parsing
import type { IncomingMessage } from "node:http";
import { BadRequestError } from "./errors.js";
import type { BodyParserOptions, JsonBodyParserOptions, UrlEncodedBodyParserOptions } from "./types.js";

const DEFAULT_LIMIT = 1024 * 1024; // 1MB

function collectBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(new BadRequestError(`Request body exceeds limit of ${limit} bytes`, { limit, received: size }));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => {
      reject(new BadRequestError(`Failed to read request body: ${err.message}`));
    });
  });
}

export async function parseJsonBody(
  req: IncomingMessage,
  options?: JsonBodyParserOptions,
): Promise<unknown> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const buffer = await collectBody(req, limit);
  const text = buffer.toString(options?.encoding ?? "utf-8");

  if (text.length === 0) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (options?.strict && typeof parsed !== "object") {
      throw new BadRequestError("JSON body must be an object or array in strict mode");
    }
    return parsed;
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw err;
    }
    throw new BadRequestError("Invalid JSON in request body");
  }
}

export async function parseUrlEncodedBody(
  req: IncomingMessage,
  options?: UrlEncodedBodyParserOptions,
): Promise<Record<string, string | string[]>> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const buffer = await collectBody(req, limit);
  const text = buffer.toString(options?.encoding ?? "utf-8");

  if (text.length === 0) {
    return {};
  }

  const params = new URLSearchParams(text);
  const result: Record<string, string | string[]> = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);
    result[key] = values.length === 1 ? values[0]! : values;
  }

  return result;
}

export async function parseTextBody(
  req: IncomingMessage,
  options?: BodyParserOptions,
): Promise<string> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const buffer = await collectBody(req, limit);
  return buffer.toString(options?.encoding ?? "utf-8");
}

export async function parseRawBody(
  req: IncomingMessage,
  options?: BodyParserOptions,
): Promise<Buffer> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  return collectBody(req, limit);
}

export function detectContentType(contentType: string | undefined): "json" | "urlencoded" | "text" | "raw" {
  if (!contentType) {
    return "raw";
  }

  const lower = contentType.toLowerCase();
  if (lower.includes("application/json")) {
    return "json";
  }
  if (lower.includes("application/x-www-form-urlencoded")) {
    return "urlencoded";
  }
  if (lower.includes("text/")) {
    return "text";
  }
  return "raw";
}

export async function parseBody(
  req: IncomingMessage,
  options?: BodyParserOptions,
): Promise<unknown> {
  const type = detectContentType(req.headers["content-type"]);

  switch (type) {
    case "json":
      return parseJsonBody(req, options);
    case "urlencoded":
      return parseUrlEncodedBody(req, options);
    case "text":
      return parseTextBody(req, options);
    case "raw":
      return parseRawBody(req, options);
  }
}
