import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { env } from "@/lib/env"

/** Laravel uses Str::random(60). */
const TOKEN_LENGTH = 60

export interface Recaller {
  userId: string
  token: string
  passwordHmac: string
}

/**
 * A fresh remember token. One per user, as in Laravel: cycling it invalidates
 * every remembered device at once.
 */
export function createRememberToken(): string {
  return randomBytes(48).toString("base64url").slice(0, TOKEN_LENGTH)
}

/**
 * HMAC of the stored password hash.
 *
 * Carried in the cookie and rechecked on recall, so changing a password
 * invalidates every outstanding recaller without touching the token.
 */
export function hashPasswordForCookie(passwordHash: string): string {
  return createHmac("sha256", env.APP_SECRET).update(passwordHash).digest("hex")
}

/** `userId|token|hmac`, the same three fields Laravel packs into its cookie. */
export function buildRecaller(
  userId: string,
  token: string,
  passwordHash: string
): string {
  return `${userId}|${token}|${hashPasswordForCookie(passwordHash)}`
}

/**
 * `users.id` is a Postgres `uuid`. Anything else sent as the first segment
 * reaches the driver as a malformed literal and raises 22P02 rather than
 * simply matching no rows, so the shape is checked here instead.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Parses the cookie, returning null for anything malformed. */
export function parseRecaller(
  value: string | undefined | null
): Recaller | null {
  if (!value) return null

  const [userId, token, passwordHmac] = value.split("|")
  if (!userId || !token || !passwordHmac) return null
  if (!UUID.test(userId)) return null

  return { userId, token, passwordHmac }
}

/** Constant-time comparison, Laravel's hash_equals. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Whether a recaller still speaks for this user: the token must match the one
 * stored, and the password must not have changed since the cookie was issued.
 */
export function recallerMatches(
  recaller: Recaller,
  stored: { rememberToken: string | null; passwordHash: string }
): boolean {
  if (!stored.rememberToken) return false
  if (!secretsMatch(stored.rememberToken, recaller.token)) return false
  return secretsMatch(
    hashPasswordForCookie(stored.passwordHash),
    recaller.passwordHmac
  )
}
