import { env } from "@/lib/env"

/**
 * Sessions are configured in minutes, because that is the unit a person
 * reasons about. JavaScript dates are milliseconds. Getting that conversion
 * wrong is a sixty-fold error in either direction, so it is named rather than
 * written inline.
 */
export const MS_PER_MINUTE = 60 * 1000

/**
 * How long a session should last, in milliseconds, or null when sessions are
 * configured never to expire.
 *
 * Lives here rather than in the login service because issuing a session is not
 * only login's concern. Anything that mints or extends one, a refresh endpoint
 * most obviously, needs the same two lifetimes and must not reimplement the
 * choice between them.
 */
export function sessionTtlMs(): number | null {
  const minutes = env.SESSION_TTL_MINUTES
  return minutes === null ? null : minutes * MS_PER_MINUTE
}

/**
 * When a session issued now should expire, or null for one that never does.
 *
 * Every caller that mints a session goes through this, so "never expires"
 * is decided in exactly one place rather than at each insert.
 */
export function sessionExpiresAt(): Date | null {
  const ttl = sessionTtlMs()
  return ttl === null ? null : new Date(Date.now() + ttl)
}

/**
 * How long the recaller cookie lives. Laravel's default is 400 days, and the
 * session it later creates is still only SESSION_TTL_MINUTES long.
 */
export function rememberTtlMs(): number {
  return env.SESSION_REMEMBER_TTL_MINUTES * MS_PER_MINUTE
}
