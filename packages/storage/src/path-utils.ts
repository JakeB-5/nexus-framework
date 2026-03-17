// @nexus/storage - Path utilities

/**
 * Normalize a storage path: forward slashes, no leading/trailing slashes,
 * collapse double slashes
 */
export function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "")
    .replace(/\/$/, "");
}

/**
 * Sanitize a path to prevent directory traversal attacks.
 * Removes ".." segments and ensures path stays within bounds.
 */
export function sanitizePath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  const safe: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      // Don't go above root
      safe.pop();
    } else if (part !== "." && part !== "") {
      safe.push(part);
    }
  }

  return safe.join("/");
}

/**
 * Check if a path is safe (no traversal attempts)
 */
export function isPathSafe(filePath: string): boolean {
  // Check the raw path before normalization strips leading slashes
  const raw = filePath.replace(/\\/g, "/");
  if (raw.startsWith("/")) return false;
  const normalized = normalizePath(filePath);
  return !normalized.includes("..");
}

/**
 * Get the file extension (without dot)
 */
export function getExtension(filePath: string): string {
  const name = filePath.split("/").pop() ?? "";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 1) return "";
  return name.slice(dotIndex + 1).toLowerCase();
}

/**
 * Get the filename from a path
 */
export function getFilename(filePath: string): string {
  return filePath.split("/").pop() ?? "";
}

/**
 * Get the directory from a path
 */
export function getDirectory(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(segments.join("/"));
}

/**
 * Simple MIME type lookup by extension
 */
export function getMimeType(filePath: string): string {
  const ext = getExtension(filePath);
  const mimeMap: Record<string, string> = {
    "txt": "text/plain",
    "html": "text/html",
    "htm": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "json": "application/json",
    "xml": "application/xml",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "webp": "image/webp",
    "pdf": "application/pdf",
    "zip": "application/zip",
    "csv": "text/csv",
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "ttf": "font/ttf",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}
