// Password hashing using node:crypto scrypt

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PasswordHashOptions, PasswordHashResult } from "./types.js";

const scryptAsync = promisify(scrypt);

const DEFAULT_SALT_LENGTH = 32;
const DEFAULT_KEY_LENGTH = 64;
const DEFAULT_COST = 16384; // N = 2^14
const DEFAULT_BLOCK_SIZE = 8;
const DEFAULT_PARALLELIZATION = 1;

export function generateSalt(length: number = DEFAULT_SALT_LENGTH): string {
  return randomBytes(length).toString("hex");
}

export async function hash(
  password: string,
  options: PasswordHashOptions = {},
): Promise<string> {
  const {
    saltLength = DEFAULT_SALT_LENGTH,
    keyLength = DEFAULT_KEY_LENGTH,
    cost = DEFAULT_COST,
    blockSize = DEFAULT_BLOCK_SIZE,
    parallelization = DEFAULT_PARALLELIZATION,
  } = options;

  const salt = generateSalt(saltLength);

  const derived = (await scryptAsync(password, salt, keyLength)) as Buffer;

  const params = `N=${cost},r=${blockSize},p=${parallelization},l=${keyLength}`;
  return `$scrypt$${params}$${salt}$${derived.toString("hex")}`;
}

export async function verify(
  password: string,
  hashString: string,
): Promise<boolean> {
  const parsed = parseHash(hashString);
  if (!parsed) {
    return false;
  }

  const derived = (await scryptAsync(
    password,
    parsed.salt,
    parsed.params.keyLength,
  )) as Buffer;

  const expected = Buffer.from(parsed.hash, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

export function parseHash(
  hashString: string,
): PasswordHashResult | undefined {
  const parts = hashString.split("$");
  // Format: $scrypt$params$salt$hash
  if (parts.length !== 5 || parts[1] !== "scrypt") {
    return undefined;
  }

  const paramStr = parts[2];
  const salt = parts[3];
  const hashHex = parts[4];

  const paramPairs = paramStr.split(",");
  const params: Record<string, number> = {};
  for (const pair of paramPairs) {
    const [key, value] = pair.split("=");
    params[key] = parseInt(value, 10);
  }

  if (
    isNaN(params["N"]) ||
    isNaN(params["r"]) ||
    isNaN(params["p"]) ||
    isNaN(params["l"])
  ) {
    return undefined;
  }

  return {
    hash: hashHex,
    salt,
    params: {
      N: params["N"],
      r: params["r"],
      p: params["p"],
      keyLength: params["l"],
    },
  };
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (password.length >= 16) {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    errors.push("Password must contain at least one digit");
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.min(score, 7),
  };
}
