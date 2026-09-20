import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/db/schema"
import { env } from "@/lib/env"

type GlobalWithPool = typeof globalThis & { __authorizaPgPool?: Pool }

const createPool = (): Pool => {
  const created = new Pool({
    connectionString: env.DATABASE_URL,
    // Storage is UTC whatever this says, but the session zone decides how
    // timestamps are read back and how date casts land. Pinning it keeps
    // `created_at::date` and date_trunc identical on every machine instead of
    // following whichever zone the host happened to install Postgres with.
    options: "-c timezone=UTC",
  })
  created.on("error", (error) => {
    console.error("Unexpected error on an idle Postgres client", error)
  })
  return created
}

// Next.js re-evaluates modules on hot reload in development. Reusing the pool
// through globalThis keeps each reload from opening a fresh set of connections.
const globalForDb = globalThis as GlobalWithPool

export const pool: Pool = globalForDb.__authorizaPgPool ?? createPool()

if (env.NODE_ENV !== "production") {
  globalForDb.__authorizaPgPool = pool
}

export const db = drizzle({ client: pool, schema })

export type Database = typeof db
