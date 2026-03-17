// JWT implementation using node:crypto

import { createHmac } from "node:crypto";
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenNotBeforeError,
} from "./errors.js";
import type {
  DecodedJwt,
  JwtAlgorithm,
  JwtHeader,
  JwtPayload,
  JwtSignOptions,
  JwtVerifyOptions,
} from "./types.js";

const ALG_MAP: Record<JwtAlgorithm, string> = {
  HS256: "sha256",
  HS384: "sha384",
  HS512: "sha512",
};

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

function createSignature(
  input: string,
  secret: string,
  algorithm: JwtAlgorithm,
): string {
  const hmacAlg = ALG_MAP[algorithm];
  const hmac = createHmac(hmacAlg, secret);
  hmac.update(input);
  return hmac.digest("base64url");
}

export function sign(
  payload: JwtPayload,
  secret: string,
  options: JwtSignOptions = {},
): string {
  const {
    algorithm = "HS256",
    expiresIn,
    notBefore,
    issuer,
    audience,
    subject,
    jwtId,
  } = options;

  if (!secret) {
    throw new InvalidTokenError("Secret is required for signing");
  }

  if (!ALG_MAP[algorithm]) {
    throw new InvalidTokenError(`Unsupported algorithm: ${algorithm}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const claims: JwtPayload = { ...payload };
  if (claims.iat === undefined) {
    claims.iat = now;
  }

  if (expiresIn !== undefined) {
    claims.exp = now + expiresIn;
  }
  if (notBefore !== undefined) {
    claims.nbf = now + notBefore;
  }
  if (issuer !== undefined) {
    claims.iss = issuer;
  }
  if (audience !== undefined) {
    claims.aud = audience;
  }
  if (subject !== undefined) {
    claims.sub = subject;
  }
  if (jwtId !== undefined) {
    claims.jti = jwtId;
  }

  const header: JwtHeader = { alg: algorithm, typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSignature(signingInput, secret, algorithm);

  return `${signingInput}.${signature}`;
}

export function decode(token: string): DecodedJwt {
  if (typeof token !== "string") {
    throw new InvalidTokenError("Token must be a string");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new InvalidTokenError("Invalid token format: expected 3 parts");
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0])) as JwtHeader;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
    const signature = parts[2];

    return { header, payload, signature };
  } catch {
    throw new InvalidTokenError("Invalid token encoding");
  }
}

export function verify(
  token: string,
  secret: string,
  options: JwtVerifyOptions = {},
): JwtPayload {
  if (!secret) {
    throw new InvalidTokenError("Secret is required for verification");
  }

  const decoded = decode(token);
  const { header, payload } = decoded;

  // Validate algorithm
  const allowedAlgorithms = options.algorithms ?? ["HS256", "HS384", "HS512"];
  if (!allowedAlgorithms.includes(header.alg)) {
    throw new InvalidTokenError(`Algorithm ${header.alg} is not allowed`);
  }

  // Verify signature
  const parts = token.split(".");
  const signingInput = `${parts[0]}.${parts[1]}`;
  const expectedSignature = createSignature(signingInput, secret, header.alg);

  if (parts[2] !== expectedSignature) {
    throw new InvalidTokenError("Invalid signature");
  }

  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = options.clockTolerance ?? 0;

  // Check expiration
  if (!options.ignoreExpiration && payload.exp !== undefined) {
    if (now > payload.exp + clockTolerance) {
      throw new TokenExpiredError(
        "Token has expired",
        new Date(payload.exp * 1000),
      );
    }
  }

  // Check maxAge
  if (options.maxAge !== undefined && payload.iat !== undefined) {
    if (now > payload.iat + options.maxAge + clockTolerance) {
      throw new TokenExpiredError("Token maxAge exceeded");
    }
  }

  // Check not before
  if (!options.ignoreNotBefore && payload.nbf !== undefined) {
    if (now < payload.nbf - clockTolerance) {
      throw new TokenNotBeforeError(
        "Token not yet valid",
        new Date(payload.nbf * 1000),
      );
    }
  }

  // Check issuer
  if (options.issuer !== undefined) {
    if (payload.iss !== options.issuer) {
      throw new InvalidTokenError(
        `Invalid issuer: expected ${options.issuer}, got ${payload.iss}`,
      );
    }
  }

  // Check audience
  if (options.audience !== undefined) {
    const audiences = Array.isArray(options.audience)
      ? options.audience
      : [options.audience];
    const tokenAudiences = Array.isArray(payload.aud)
      ? payload.aud
      : payload.aud
        ? [payload.aud]
        : [];

    const hasMatch = audiences.some((aud) => tokenAudiences.includes(aud));
    if (!hasMatch) {
      throw new InvalidTokenError("Invalid audience");
    }
  }

  // Check subject
  if (options.subject !== undefined) {
    if (payload.sub !== options.subject) {
      throw new InvalidTokenError(
        `Invalid subject: expected ${options.subject}, got ${payload.sub}`,
      );
    }
  }

  return payload;
}

export function refresh(
  token: string,
  secret: string,
  newExpiresIn: number,
  verifyOptions?: JwtVerifyOptions,
): string {
  const payload = verify(token, secret, verifyOptions);
  const { iat: _iat, exp: _exp, ...rest } = payload;
  return sign(rest, secret, { expiresIn: newExpiresIn });
}
