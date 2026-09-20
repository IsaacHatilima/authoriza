import "@/lib/load-env"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

import { MIGRATIONS_DIR } from "./db/paths"
import { assertTestDatabase } from "./vitest.shared"

/**
 * Brings the test database up to date once, before any test file runs, so no
 * individual suite has to know about migrations.
 */
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  assertTestDatabase(databaseUrl)

  const pool = new Pool({
    connectionString: databaseUrl,
    options: "-c timezone=UTC",
  })
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR })
  } finally {
    await pool.end()
  }
}
