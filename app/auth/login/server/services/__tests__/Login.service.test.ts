import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { db, pool } from "@/db/client"
import { env } from "@/lib/env"
import { profiles, sessions, users } from "@/db/schema"
import { hashPassword } from "@/lib/password"
import { hashSessionToken } from "@/lib/session-token"
import { requireExpiry } from "@/vitest.helpers"

import { InvalidCredentialsError } from "../../../types/Auth.errors"
import { LoginService } from "../Login.service"

const service = new LoginService()
const PASSWORD = "correct horse battery staple"
const ORIGIN = { ip: "203.0.113.7", userAgent: "vitest" }

const createUser = async (email = "ada@example.com") => {
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(PASSWORD) })
    .returning()
  return user
}

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(profiles)
  await db.delete(users)
})

afterAll(async () => {
  await pool.end()
})

describe("the profile on the signed-in user", () => {
  it("returns the name from the profile", async () => {
    const user = await createUser()
    await db
      .insert(profiles)
      .values({ userId: user.id, firstName: "Ada", lastName: "Lovelace" })

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.user.name).toBe("Ada Lovelace")
  })

  it("returns a null name when the user has no profile yet", async () => {
    await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.user.name).toBeNull()
  })

  it("still signs in a user with no profile", async () => {
    await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.user.email).toBe("ada@example.com")
  })
})

describe("remember me", () => {
  it("returns no recaller for an ordinary login", async () => {
    await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.recaller).toBeNull()
    const [user] = await db.select().from(users)
    expect(user.rememberToken).toBeNull()
  })

  it("stores a remember token and returns a recaller when remembered", async () => {
    await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD, remember: true },
      ORIGIN
    )

    const [user] = await db.select().from(users)
    expect(user.rememberToken).toHaveLength(60)
    expect(result.recaller?.split("|")[1]).toBe(user.rememberToken)
  })

  it("cycles the token on each remembered login, as Laravel does", async () => {
    await createUser()
    const credentials = {
      email: "ada@example.com",
      password: PASSWORD,
      remember: true,
    }

    await service.handle(credentials, ORIGIN)
    const [first] = await db.select().from(users)
    await service.handle(credentials, ORIGIN)
    const [second] = await db.select().from(users)

    expect(second.rememberToken).not.toBe(first.rememberToken)
  })

  it("never puts the password hash in the recaller", async () => {
    const user = await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD, remember: true },
      ORIGIN
    )

    expect(result.recaller).not.toContain(user.passwordHash)
  })
})

describe("session lifetime", () => {
  const minutesFrom = (issuedAt: number, expiresAt: Date | null) =>
    Math.round((requireExpiry(expiresAt).getTime() - issuedAt) / 60_000)

  it("uses the short lifetime by default", async () => {
    await createUser()
    const before = Date.now()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(minutesFrom(before, result.session.expiresAt)).toBe(
      env.SESSION_TTL_MINUTES
    )
  })

  it("does not lengthen the session when remembered, as in Laravel", async () => {
    await createUser()
    const before = Date.now()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD, remember: true },
      ORIGIN
    )

    expect(minutesFrom(before, result.session.expiresAt)).toBe(
      env.SESSION_TTL_MINUTES
    )
  })

  it("treats remember false the same as omitting it", async () => {
    await createUser()
    const before = Date.now()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD, remember: false },
      ORIGIN
    )

    expect(minutesFrom(before, result.session.expiresAt)).toBe(
      env.SESSION_TTL_MINUTES
    )
  })

  it("stores the same expiry on the session row", async () => {
    const user = await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD, remember: true },
      ORIGIN
    )

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
    expect(requireExpiry(row.expiresAt).getTime()).toBe(
      requireExpiry(result.session.expiresAt).getTime()
    )
  })

  it("gives a remembered login the same session length, plus a recaller", async () => {
    await createUser()

    const normal = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )
    const remembered = await service.handle(
      { email: "ada@example.com", password: PASSWORD, remember: true },
      ORIGIN
    )

    const span = (at: Date | null, from: Date) =>
      requireExpiry(at).getTime() - from.getTime()
    expect(
      Math.abs(
        span(remembered.session.expiresAt, new Date()) -
          span(normal.session.expiresAt, new Date())
      )
    ).toBeLessThan(2000)
    expect(normal.recaller).toBeNull()
    expect(remembered.recaller).not.toBeNull()
  })
})

describe("LoginService", () => {
  it("returns the user and a session for correct credentials", async () => {
    const user = await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.user.id).toBe(user.id)
    expect(result.user.email).toBe("ada@example.com")
    expect(result.user.role).toBe("hr")
    expect(result.session.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(requireExpiry(result.session.expiresAt).getTime()).toBeGreaterThan(
      Date.now()
    )
  })

  it("never returns the password hash", async () => {
    await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(Object.keys(result.user).sort()).toEqual([
      "email",
      "emailVerified",
      "id",
      "name",
      "role",
    ])
    expect(JSON.stringify(result)).not.toContain("argon2")
  })

  it("stores only the hash of the session token", async () => {
    const user = await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))

    expect(row.tokenHash).toBe(hashSessionToken(result.session.token))
    expect(row.tokenHash).not.toBe(result.session.token)
    expect(row.ip).toBe(ORIGIN.ip)
    expect(row.userAgent).toBe(ORIGIN.userAgent)
  })

  it("issues a brand new session on every login", async () => {
    const user = await createUser()

    const first = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )
    const second = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))

    expect(first.session.token).not.toBe(second.session.token)
    expect(rows).toHaveLength(2)
  })

  it("rejects a wrong password", async () => {
    await createUser()

    await expect(
      service.handle(
        { email: "ada@example.com", password: "not the password" },
        ORIGIN
      )
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it("rejects an unknown email with the same error as a wrong password", async () => {
    await expect(
      service.handle(
        { email: "nobody@example.com", password: PASSWORD },
        ORIGIN
      )
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it("creates no session for a failed login", async () => {
    await createUser()

    await service
      .handle({ email: "ada@example.com", password: "wrong" }, ORIGIN)
      .catch(() => undefined)

    await expect(db.select().from(sessions)).resolves.toEqual([])
  })

  it("spends comparable time on an unknown email as on a wrong password", async () => {
    await createUser()
    const elapsed = async (email: string) => {
      const started = performance.now()
      await service
        .handle({ email, password: "wrong password" }, ORIGIN)
        .catch(() => undefined)
      return performance.now() - started
    }

    const known = await elapsed("ada@example.com")
    const unknown = await elapsed("nobody@example.com")

    // The dummy hash makes the unknown-email path do real argon2 work. Without
    // it the unknown path returns almost instantly and leaks which emails exist.
    expect(unknown).toBeGreaterThan(known / 4)
  })

  it("reports an unverified email without blocking the login", async () => {
    await createUser()

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.user.emailVerified).toBe(false)
  })

  it("reports a verified email", async () => {
    await createUser()
    await db.update(users).set({ emailVerifiedAt: new Date() })

    const result = await service.handle(
      { email: "ada@example.com", password: PASSWORD },
      ORIGIN
    )

    expect(result.user.emailVerified).toBe(true)
  })
})
