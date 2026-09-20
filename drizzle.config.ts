import "./lib/load-env"

import { defineConfig } from "drizzle-kit"

import { MIGRATIONS_DIR } from "./db/paths"
import { env } from "./lib/env"

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: MIGRATIONS_DIR,
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
  verbose: true,
})
