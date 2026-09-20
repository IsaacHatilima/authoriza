/**
 * Helpers shared between test files. Lives at the root, beside the other
 * vitest files, so it stays out of the coverage report and out of the
 * application's import graph.
 */

/**
 * Narrows a session expiry to a date.
 *
 * `expiresAt` is nullable because SESSION_TTL_MINUTES may be null, but the
 * test environment configures an expiring session. Assertions about when a
 * session ends are therefore meaningless if it is null, and this fails loudly
 * rather than letting a `!` quietly assert something untrue.
 */
export function requireExpiry(expiresAt: Date | null): Date {
  if (expiresAt === null) {
    throw new Error(
      "Expected a session with an expiry. Is SESSION_TTL_MINUTES null in .env.test?"
    )
  }
  return expiresAt
}
