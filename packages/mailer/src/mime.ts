// MIME utilities

import type { AddressInput, MailAddress } from "./types.js";

const MIME_TYPES: Record<string, string> = {
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  csv: "text/csv",
  xml: "text/xml",
  json: "application/json",
  js: "application/javascript",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wav: "audio/wav",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  eml: "message/rfc822",
  ics: "text/calendar",
};

export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function base64Encode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64");
}

export function base64Decode(input: string): Buffer {
  return Buffer.from(input, "base64");
}

export function quotedPrintableEncode(input: string): string {
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    let encoded: string;

    if (
      (charCode >= 33 && charCode <= 126 && charCode !== 61) ||
      charCode === 9 ||
      charCode === 32
    ) {
      encoded = input[i];
    } else if (charCode === 13 && input.charCodeAt(i + 1) === 10) {
      // CRLF
      lines.push(currentLine);
      currentLine = "";
      i++; // skip LF
      continue;
    } else if (charCode === 10) {
      lines.push(currentLine);
      currentLine = "";
      continue;
    } else {
      encoded = "=" + charCode.toString(16).toUpperCase().padStart(2, "0");
    }

    if (currentLine.length + encoded.length > 75) {
      lines.push(currentLine + "=");
      currentLine = encoded;
    } else {
      currentLine += encoded;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\r\n");
}

export function parseEmailAddress(input: string): MailAddress {
  const match = input.match(/^(?:"?(.+?)"?\s+)?<?([^\s<>]+@[^\s<>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim(),
      address: match[2].trim(),
    };
  }
  return { address: input.trim() };
}

export function formatEmailAddress(addr: string | MailAddress): string {
  if (typeof addr === "string") {
    return addr;
  }
  if (addr.name) {
    return `"${addr.name}" <${addr.address}>`;
  }
  return addr.address;
}

export function normalizeAddresses(input: AddressInput): MailAddress[] {
  if (typeof input === "string") {
    return [parseEmailAddress(input)];
  }
  if (Array.isArray(input)) {
    return input.map((item) => {
      if (typeof item === "string") {
        return parseEmailAddress(item);
      }
      return item;
    });
  }
  return [input];
}

export function formatAddressList(input: AddressInput): string {
  const addresses = normalizeAddresses(input);
  return addresses.map(formatEmailAddress).join(", ");
}

export function isValidEmail(email: string): boolean {
  // Basic RFC 5322 validation
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}

export function generateBoundary(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "----nexus_";
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function generateMessageId(domain = "nexus.local"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `<${timestamp}.${random}@${domain}>`;
}
