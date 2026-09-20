import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { SESSION_COOKIE_NAME } from "@/lib/cookies"
import { sessionService } from "@/shared/session"

import { db, pool } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"
import { hashPassword } from "@/lib/password"
import { buildRecaller, createRememberToken } from "@/lib/remember"
import { REMEMBER_COOKIE_NAME } from "@/lib/cookies"
import { requireExpiry } from "@/vitest.helpers"

import { GET, safeNextPath } from "../route"

const PASSWORD = "a-good-password"

const get = (recaller?: string, next = "/dashboard") =>
  GET(
    new NextRequest(`http://localhost/api/auth/recall?next=${next}`, {
      headers: recaller
        ? { cookie: `${REMEMBER_COOKIE_NAME}=${recaller}` }
        : {},
    })
  )

const rememberedUser = async () => {
  const passwordHash = await hashPassword(PASSWORD)
  const token = createRememberToken()
  const [user] = await db
    .insert(users)
    .values({ email: "ada@example.com", passwordHash, rememberToken: token })
    .returning()
  return { user, recaller: buildRecaller(user.id, token, passwordHash) }
}

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(profiles)
  await db.delete(users)
})

afterAll(async () => {
  await pool.end()
})

describe("safeNextPath", () => {
  it("keeps an in-app path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard")
  })

  it.each([null, "", "https://evil.test", "//evil.test", "evil"])(
    "refuses %s and falls back to the root",
    (value) => {
      expect(safeNextPath(value)).toBe("/")
    }
  )

  // Regression: the guard used to be a pair of string tests, and the URL
  // parser treats a backslash as a slash for http(s). "/\\evil.com" therefore
  // passed the guard and then resolved to https://evil.com/.
  it.each([
    "/\\evil.test",
    "/\\\\evil.test",
    "/\\/evil.test",
    "/..//evil.test",
    "/./..//evil.test",
    "/foo/../..//evil.test",
  ])("refuses the off-site vector %s", (value) => {
    expect(safeNextPath(value)).toBe("/")
  })

  it("never resolves a guarded value to another origin", () => {
    const base = new URL("https://app.test/api/auth/recall")

    for (const vector of ["/\\evil.test", "/..//evil.test", "//evil.test"]) {
      const resolved = new URL(safeNextPath(vector), base)
      expect(resolved.origin).toBe("https://app.test")
    }
  })

  it("keeps the query string and fragment of a real path", () => {
    expect(safeNextPath("/dashboard?tab=2#top")).toBe("/dashboard?tab=2#top")
  })
})

describe("GET /api/auth/recall", () => {
  it("turns a valid recaller into a new session and continues", async () => {
    const { user, recaller } = await rememberedUser()

    const response = await get(recaller)
    const token = response.cookies.get(SESSION_COOKIE_NAME)?.value

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/dashboard")
    const session = await sessionService.findByToken(token)
    expect(session?.user.id).toBe(user.id)
  })

  it("issues a session no longer than an ordinary one", async () => {
    const { recaller } = await rememberedUser()

    await get(recaller)

    const [row] = await db.select().from(sessions)
    const minutes = Math.round(
      (requireExpiry(row.expiresAt).getTime() - row.createdAt.getTime()) /
        60_000
    )
    expect(minutes).toBe(60)
  })

  it("treats a malformed recaller as stale instead of returning a 500", async () => {
    // Regression: the user id went straight to a Postgres uuid column, so a
    // junk cookie raised 22P02. The 500 also skipped the cookie-clearing
    // branch, leaving the browser bouncing back here on every page.
    const response = await get("not-a-uuid|token|hmac")

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/auth/login")
    expect(response.cookies.get(REMEMBER_COOKIE_NAME)?.maxAge).toBe(0)
  })

  it("refuses a recaller whose token was cycled, and clears the cookie", async () => {
    const { user, recaller } = await rememberedUser()
    await db
      .update(users)
      .set({ rememberToken: createRememberToken() })
      .where(eq(users.id, user.id))

    const response = await get(recaller)

    expect(response.headers.get("location")).toContain("/auth/login")
    expect(response.cookies.get(REMEMBER_COOKIE_NAME)?.maxAge).toBe(0)
    await expect(db.select().from(sessions)).resolves.toEqual([])
  })

  it("refuses once the password has changed", async () => {
    const { user, recaller } = await rememberedUser()
    await db
      .update(users)
      .set({ passwordHash: await hashPassword("a-different-password") })
      .where(eq(users.id, user.id))

    const response = await get(recaller)

    expect(response.headers.get("location")).toContain("/auth/login")
  })

  it("refuses when the user was forgotten on logout", async () => {
    const { user, recaller } = await rememberedUser()
    await db
      .update(users)
      .set({ rememberToken: null })
      .where(eq(users.id, user.id))

    const response = await get(recaller)

    expect(response.headers.get("location")).toContain("/auth/login")
  })

  it("refuses a forged cookie", async () => {
    const { user } = await rememberedUser()

    const response = await get(`${user.id}|guessed-token|deadbeef`)

    expect(response.headers.get("location")).toContain("/auth/login")
  })

  it("refuses when there is no cookie at all", async () => {
    const response = await get()

    expect(response.headers.get("location")).toContain("/auth/login")
  })

  it("never redirects off-site, even when asked to", async () => {
    const { recaller } = await rememberedUser()

    const response = await get(recaller, "https://evil.test")

    expect(response.headers.get("location")).toContain("localhost")
    expect(response.headers.get("location")).not.toContain("evil.test")
  })
})
