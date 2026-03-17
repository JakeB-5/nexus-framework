// @nexus/http - Cookie parsing and serialization
import { createHmac } from "node:crypto";
import type { CookieOptions } from "./types.js";

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (key.length > 0) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

export function serializeCookie(name: string, value: string, options?: CookieOptions): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options?.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options?.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options?.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (options?.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options?.httpOnly) {
    cookie += "; HttpOnly";
  }

  if (options?.secure) {
    cookie += "; Secure";
  }

  if (options?.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }

  return cookie;
}

export function signCookie(value: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
}

export function unsignCookie(signedValue: string, secret: string): string | false {
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot === -1) {
    return false;
  }

  const value = signedValue.slice(0, lastDot);
  const signature = signedValue.slice(lastDot + 1);

  const expected = createHmac("sha256", secret)
    .update(value)
    .digest("base64url");

  // Timing-safe comparison
  if (signature.length !== expected.length) {
    return false;
  }

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    mismatch |= sigBuf[i]! ^ expBuf[i]!;
  }

  return mismatch === 0 ? value : false;
}
