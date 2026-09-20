import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { sessionService } from "../Session.service"

import { db, pool } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"
import { env } from "@/lib/env"
import { hashPassword } from "@/lib/password"
import { sessionExpiresAt } from "@/lib/session-lifetime"
import { createSessionToken, hashSessionToken } from "@/lib/session-token"

const createUser = async (role: "admin" | "hr" = "hr") => {
  const [user] = await db
    .insert(users)
    .values({
      email: `${role}@example.com`,
      passwordHash: await hashPassword("a-good-password"),
      role,
    })
    .returning()
  return user
}

const givenSession = async (
  userId: string,
  overrides: { expiresAt?: Date | null; revokedAt?: Date } = {}
) => {
  const token = createSessionToken()
  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    // An explicit null is a session that never expires, so it is honoured
    // rather than being filled in with the configured lifetime.
    expiresAt:
      "expiresAt" in overrides ? overrides.expiresAt : sessionExpiresAt(),
    revokedAt: overrides.revokedAt ?? null,
  })
  return token
}

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(profiles)
  await db.delete(users)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await pool.end()
})

/** Puts the app in the SESSION_TTL_MINUTES=null mode for one test. */
const withNeverExpiringSessions = () =>
  vi.spyOn(env, "SESSION_TTL_MINUTES", "get").mockReturnValue(null)

describe("findByToken", () => {
  it("returns the signed-in user and their role", async () => {
    const user = await createUser("admin")
    const token = await givenSession(user.id)

    const found = await sessionService.findByToken(token)

    expect(found?.user.id).toBe(user.id)
    expect(found?.user.email).toBe("admin@example.com")
    expect(found?.user.role).toBe("admin")
  })

  it("carries the name from the profile", async () => {
    const user = await createUser()
    await db
      .insert(profiles)
      .values({ userId: user.id, firstName: "Ada", lastName: "Lovelace" })
    const token = await givenSession(user.id)

    const found = await sessionService.findByToken(token)

    expect(found?.user.name).toBe("Ada Lovelace")
  })

  it("has a null name when the user has no profile", async () => {
    const user = await createUser()
    const token = await givenSession(user.id)

    const found = await sessionService.findByToken(token)

    expect(found?.user.name).toBeNull()
  })

  it("never exposes the password hash", async () => {
    const user = await createUser()
    const token = await givenSession(user.id)

    const found = await sessionService.findByToken(token)

    expect(Object.keys(found?.user ?? {}).sort()).toEqual([
      "email",
      "emailVerified",
      "id",
      "name",
      "role",
    ])
  })

  it("returns null for a token that was never issued", async () => {
    await expect(
      sessionService.findByToken(createSessionToken())
    ).resolves.toBeNull()
  })

  it("returns null for an expired session", async () => {
    const user = await createUser()
    const token = await givenSession(user.id, {
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(sessionService.findByToken(token)).resolves.toBeNull()
  })

  it("accepts a session with no expiry, which never goes stale", async () => {
    const user = await createUser()
    const token = await givenSession(user.id, { expiresAt: null })

    await expect(sessionService.findByToken(token)).resolves.not.toBeNull()
  })

  it("still refuses a session with no expiry once it is revoked", async () => {
    // Never expiring must not mean unrevocable: signing out has to work.
    const user = await createUser()
    const token = await givenSession(user.id, {
      expiresAt: null,
      revokedAt: new Date(),
    })

    await expect(sessionService.findByToken(token)).resolves.toBeNull()
  })

  it("returns null for a revoked session", async () => {
    const user = await createUser()
    const token = await givenSession(user.id, { revokedAt: new Date() })

    await expect(sessionService.findByToken(token)).resolves.toBeNull()
  })

  it("returns null for an empty token without querying", async () => {
    await expect(sessionService.findByToken("")).resolves.toBeNull()
    await expect(sessionService.findByToken(undefined)).resolves.toBeNull()
  })

  it("records that the session was used", async () => {
    const user = await createUser()
    const token = await givenSession(user.id)
    const [before] = await db.select().from(sessions)

    await new Promise((resolve) => setTimeout(resolve, 10))
    await sessionService.findByToken(token)

    const [after] = await db.select().from(sessions)
    expect(after.lastUsedAt.getTime()).toBeGreaterThan(
      before.lastUsedAt.getTime()
    )
  })

  it("dies with its user", async () => {
    const user = await createUser()
    const token = await givenSession(user.id)

    await db.delete(users)

    await expect(sessionService.findByToken(token)).resolves.toBeNull()
  })
})

describe("issue", () => {
  it("creates a live session for the user", async () => {
    const user = await createUser()

    const issued = await sessionService.issue(user.id, {
      ip: "203.0.113.7",
      userAgent: "vitest",
    })

    const found = await sessionService.findByToken(issued.token)
    expect(found?.user.id).toBe(user.id)
  })

  it("records where the session came from", async () => {
    const user = await createUser()

    await sessionService.issue(user.id, {
      ip: "203.0.113.7",
      userAgent: "vitest",
    })

    const [row] = await db.select().from(sessions)
    expect(row.ip).toBe("203.0.113.7")
    expect(row.userAgent).toBe("vitest")
  })

  it("stores no expiry at all when sessions never expire", async () => {
    withNeverExpiringSessions()
    const user = await createUser()

    const issued = await sessionService.issue(user.id, {
      ip: null,
      userAgent: null,
    })

    // Null in the column, not a date far in the future: the difference is
    // what makes the session survive any clock or any ceiling on dates.
    const [row] = await db.select().from(sessions)
    expect(issued.expiresAt).toBeNull()
    expect(row.expiresAt).toBeNull()
  })

  it("issues a session that is still live when sessions never expire", async () => {
    withNeverExpiringSessions()
    const user = await createUser()

    const issued = await sessionService.issue(user.id, {
      ip: null,
      userAgent: null,
    })

    await expect(
      sessionService.findByToken(issued.token)
    ).resolves.not.toBeNull()
  })

  it("stores only the digest, never the token", async () => {
    const user = await createUser()

    const issued = await sessionService.issue(user.id, {
      ip: null,
      userAgent: null,
    })

    const [row] = await db.select().from(sessions)
    expect(row.tokenHash).toBe(hashSessionToken(issued.token))
    expect(row.tokenHash).not.toBe(issued.token)
  })
})

describe("revokeByToken", () => {
  it("makes the session unusable but keeps the row for audit", async () => {
    const user = await createUser()
    const token = await givenSession(user.id)

    await sessionService.revokeByToken(token)

    await expect(sessionService.findByToken(token)).resolves.toBeNull()
    const [row] = await db.select().from(sessions)
    expect(row.revokedAt).toBeInstanceOf(Date)
  })

  it("leaves other sessions of the same user alone", async () => {
    const user = await createUser()
    const first = await givenSession(user.id)
    const second = await givenSession(user.id)

    await sessionService.revokeByToken(first)

    await expect(sessionService.findByToken(second)).resolves.not.toBeNull()
  })

  it("is a no-op for an unknown or empty token", async () => {
    await expect(
      sessionService.revokeByToken(createSessionToken())
    ).resolves.toBeUndefined()
    await expect(sessionService.revokeByToken("")).resolves.toBeUndefined()
  })
})
