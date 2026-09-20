/**
 * The names of the two cookies this app sets. Kept together, and away from
 * the code that reads the database, so a rename cannot leave one caller
 * looking for the old name.
 */
export const SESSION_COOKIE_NAME = "authoriza_session"
export const REMEMBER_COOKIE_NAME = "authoriza_remember"

/**
 * A cookie cannot be told to live forever. RFC 6265bis caps any expiry at 400
 * days, and Chrome and Firefox already enforce it, so a session that never
 * expires still needs a date: the longest one a browser will honour.
 */
export const MAX_COOKIE_AGE_SECONDS = 400 * 24 * 60 * 60

/**
 * How long the session cookie should live for a session that expires at the
 * given instant, or that never expires.
 *
 * Returned as the cookie options themselves so a caller cannot pass both
 * `expires` and `maxAge`, which browsers resolve in favour of `maxAge`.
 */
export function sessionCookieLifetime(
  expiresAt: Date | null
): { expires: Date } | { maxAge: number } {
  return expiresAt === null
    ? { maxAge: MAX_COOKIE_AGE_SECONDS }
    : { expires: expiresAt }
}
