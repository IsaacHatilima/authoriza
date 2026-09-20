import { createHash, randomBytes } from "node:crypto"

/** 32 bytes of CSPRNG output, url-safe so it is a valid cookie value. */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * The database stores this digest, never the token itself, so a leaked dump
 * cannot be replayed as a live session. SHA-256 rather than argon2 is correct
 * here: the token is already 256 bits of randomness, so there is nothing to
 * brute force, and a slow KDF would tax every authenticated request.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url")
}
