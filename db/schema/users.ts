import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { DEFAULT_USER_ROLE, USER_ROLES } from "@/lib/roles"

import { timestamps } from "./columns"

/** A database enum, so an unknown role cannot be written at all. */
export const userRoleEnum = pgEnum("user_role", USER_ROLES)

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default(DEFAULT_USER_ROLE),
  /**
   * Laravel's remember_token. One per user, not per device, so cycling it
   * signs out every remembered device at once.
   */
  rememberToken: text("remember_token"),
  emailVerifiedAt: timestamp("email_verified_at", {
    withTimezone: true,
    mode: "date",
  }),
  ...timestamps,
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
