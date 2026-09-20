import { sql } from "drizzle-orm"
import { timestamp } from "drizzle-orm/pg-core"

/**
 * Audit columns shared by every table. Both timestamps use the database clock:
 * `$onUpdate` returns SQL rather than a JS Date so updated_at stays comparable
 * to created_at regardless of the application host's clock.
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
}
