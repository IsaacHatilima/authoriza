/** Suffix every database these tests are allowed to touch must carry. */
const TEST_DATABASE_SUFFIX = "_test"

/**
 * The suite truncates tables, so refuse to run against anything but a
 * throwaway database. Vitest only *defaults* NODE_ENV to "test" and @next/env
 * never overrides a variable the shell already exported, so either can
 * silently redirect these tests at the development database.
 */
export function assertTestDatabase(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Tests expect .env.test to provide it."
    )
  }

  const database = new URL(databaseUrl).pathname.replace(/^\//, "")
  if (!database.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to run tests against the database "${database}": ` +
        `expected a name ending in "${TEST_DATABASE_SUFFIX}". ` +
        "Unset DATABASE_URL and NODE_ENV in your shell so .env.test applies."
    )
  }

  return database
}
