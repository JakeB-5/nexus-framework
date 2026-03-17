// @nexus/security - IP filtering middleware

import type { NexusRequestInterface, NexusResponseInterface, NextFunction } from "@nexus/http";
import type { IpFilterOptions, SecurityMiddleware } from "./types.js";

/**
 * Parse a CIDR notation string into network address and prefix length
 */
export function parseCidr(cidr: string): { ip: number[]; prefixLength: number } | null {
  const parts = cidr.split("/");
  if (parts.length !== 2) return null;

  const ipStr = parts[0];
  const prefix = parseInt(parts[1]!, 10);
  if (isNaN(prefix)) return null;

  const ipParts = ipStr!.split(".").map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }

  if (prefix < 0 || prefix > 32) return null;

  return { ip: ipParts, prefixLength: prefix };
}

/**
 * Convert IPv4 string to 32-bit number
 */
function ipToNumber(ipParts: number[]): number {
  return ((ipParts[0]! << 24) | (ipParts[1]! << 16) | (ipParts[2]! << 8) | ipParts[3]!) >>> 0;
}

/**
 * Check if an IP address matches a CIDR range
 */
export function matchesCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;

  const ipParts = ip.split(".").map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const ipNum = ipToNumber(ipParts);
  const networkNum = ipToNumber(parsed.ip);
  const mask = parsed.prefixLength === 0 ? 0 : (~0 << (32 - parsed.prefixLength)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Normalize an IP address (handles IPv6-mapped IPv4)
 */
export function normalizeIp(ip: string): string {
  // Handle IPv6-mapped IPv4 (::ffff:127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  // Handle IPv6 loopback
  if (ip === "::1") {
    return "127.0.0.1";
  }
  return ip;
}

/**
 * Check if an IP matches any entry in a list (exact match or CIDR)
 */
export function isIpInList(ip: string, list: string[]): boolean {
  const normalizedIp = normalizeIp(ip);

  for (const entry of list) {
    if (entry.includes("/")) {
      // CIDR match
      if (matchesCidr(normalizedIp, entry)) return true;
    } else {
      // Exact match
      if (normalizeIp(entry) === normalizedIp) return true;
    }
  }

  return false;
}

/**
 * Create IP filter middleware
 */
export function ipFilter(options: IpFilterOptions): SecurityMiddleware {
  const { mode, ips, handler } = options;

  return (req: NexusRequestInterface, res: NexusResponseInterface, next: NextFunction): void => {
    const clientIp = normalizeIp(req.ip);
    const inList = isIpInList(clientIp, ips);

    let allowed: boolean;
    if (mode === "whitelist") {
      allowed = inList;
    } else {
      allowed = !inList;
    }

    if (!allowed) {
      if (handler) {
        handler(req, res);
        return;
      }
      res.status(403).json({
        error: "Forbidden",
        message: "IP address not allowed",
        statusCode: 403,
      });
      return;
    }

    next();
  };
}
