import { pgTable, text, uuid } from "drizzle-orm/pg-core"

import { timestamps } from "./columns"
import { users } from "./users"

/**
 * One profile per user. The unique constraint on user_id is what makes the
 * relationship 1:1 at the database level; the foreign key cascades so deleting
 * a user removes its profile.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarUrl: text("avatar_url"),
  ...timestamps,
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
