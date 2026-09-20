/**
 * Where drizzle-kit writes migrations and where the migrator reads them.
 * Side-effect free so both drizzle.config.ts and tests can import it.
 */
export const MIGRATIONS_DIR = "./db/migrations"
