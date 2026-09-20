import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { timestamps } from "./columns"
import { users } from "./users"

/**
 * One row per signed-in device. The cookie carries a random token; only its
 * SHA-256 digest is stored here, so a database leak does not hand out live
 * sessions. Lookups filter on `expiresAt` and `revokedAt` in SQL rather than in
 * application code, so a forgotten check cannot revive a dead session. A null
 * `expiresAt` is a session with no expiry at all, never an unset one.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    // Nullable: SESSION_TTL_MINUTES=null issues sessions that never expire,
    // as Sanctum's `expiration => null` does for its tokens.
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
)

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
