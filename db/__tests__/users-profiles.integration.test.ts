import { randomUUID } from "node:crypto"

import { eq, sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { db, pool } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"

/** Extracts the Postgres error code whether or not Drizzle wrapped the error. */
const pgErrorCode = (error: unknown): string | undefined => {
  const direct = (error as { code?: string }).code
  const nested = (error as { cause?: { code?: string } }).cause?.code
  return nested ?? direct
}

const UNIQUE_VIOLATION = "23505"
const FOREIGN_KEY_VIOLATION = "23503"
const NOT_NULL_VIOLATION = "23502"

/**
 * node-postgres truncates timestamps to whole milliseconds, so two writes in
 * the same millisecond are indistinguishable. Wait past that resolution before
 * asserting that a timestamp moved.
 */
const waitForClockTick = () => new Promise((resolve) => setTimeout(resolve, 10))

const createUser = async (email = "ada@example.com") => {
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: "argon2id$test-hash" })
    .returning()
  return user
}

const createProfile = async (userId: string, firstName = "Ada") => {
  const [profile] = await db
    .insert(profiles)
    .values({ userId, firstName, lastName: "Lovelace" })
    .returning()
  return profile
}

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(profiles)
  await db.delete(users)
})

afterAll(async () => {
  await pool.end()
})

describe("users and profiles (1:1)", () => {
  it("creates a user and its profile and loads them from both sides", async () => {
    const user = await createUser()
    const profile = await createProfile(user.id)

    const foundUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: { profile: true },
    })
    const foundProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profile.id),
      with: { user: true },
    })

    expect(foundUser?.profile?.id).toBe(profile.id)
    expect(foundUser?.profile?.firstName).toBe("Ada")
    expect(foundProfile?.user.email).toBe("ada@example.com")
  })

  it("returns a null profile for a user without one", async () => {
    const user = await createUser()

    const found = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: { profile: true },
    })

    expect(found?.profile).toBeNull()
  })

  it("rejects a second profile for the same user", async () => {
    const user = await createUser()
    await createProfile(user.id)

    await expect(createProfile(user.id)).rejects.toSatisfy(
      (error) => pgErrorCode(error) === UNIQUE_VIOLATION
    )
  })

  it("rejects moving a profile onto a user that already has one", async () => {
    const [first, second] = [
      await createUser("first@example.com"),
      await createUser("second@example.com"),
    ]
    const firstProfile = await createProfile(first.id, "Grace")
    await createProfile(second.id, "Ada")

    await expect(
      db
        .update(profiles)
        .set({ userId: second.id })
        .where(eq(profiles.id, firstProfile.id))
    ).rejects.toSatisfy((error) => pgErrorCode(error) === UNIQUE_VIOLATION)
  })

  it("allows moving a profile onto a user that has none", async () => {
    const first = await createUser("first@example.com")
    const second = await createUser("second@example.com")
    const profile = await createProfile(first.id)

    const [moved] = await db
      .update(profiles)
      .set({ userId: second.id })
      .where(eq(profiles.id, profile.id))
      .returning()

    expect(moved.userId).toBe(second.id)
  })

  it("rejects a profile whose user does not exist", async () => {
    await expect(createProfile(randomUUID())).rejects.toSatisfy(
      (error) => pgErrorCode(error) === FOREIGN_KEY_VIOLATION
    )
  })

  it("rejects a profile with no user at all", async () => {
    await expect(
      db.execute(
        sql`insert into profiles (user_id, first_name, last_name) values (null, 'Ada', 'Lovelace')`
      )
    ).rejects.toSatisfy((error) => pgErrorCode(error) === NOT_NULL_VIOLATION)
  })

  it("rejects duplicate emails", async () => {
    await createUser("dup@example.com")

    await expect(createUser("dup@example.com")).rejects.toSatisfy(
      (error) => pgErrorCode(error) === UNIQUE_VIOLATION
    )
  })

  it("deletes the profile when its user is deleted", async () => {
    const user = await createUser()
    const profile = await createProfile(user.id)

    await db.delete(users).where(eq(users.id, user.id))

    const remaining = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profile.id))
    expect(remaining).toHaveLength(0)
  })

  it("keeps the user when its profile is deleted", async () => {
    const user = await createUser()
    const profile = await createProfile(user.id)

    await db.delete(profiles).where(eq(profiles.id, profile.id))

    const remaining = await db.select().from(users).where(eq(users.id, user.id))
    expect(remaining).toHaveLength(1)
  })

  it("refreshes updated_at when a profile changes", async () => {
    const user = await createUser()
    const profile = await createProfile(user.id)
    await waitForClockTick()

    const [updated] = await db
      .update(profiles)
      .set({ lastName: "Byron" })
      .where(eq(profiles.id, profile.id))
      .returning()

    expect(updated.lastName).toBe("Byron")
    expect(updated.createdAt.getTime()).toBe(profile.createdAt.getTime())
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      profile.updatedAt.getTime()
    )
  })
})
