import { NextRequest } from "next/server"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  MAX_COOKIE_AGE_SECONDS,
  REMEMBER_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/cookies"

import { db, pool } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"
import { env } from "@/lib/env"
import { hashPassword } from "@/lib/password"
import { resetRateLimits } from "@/lib/rate-limit"

import { POST } from "../route"

const PASSWORD = "correct horse battery staple"
const EMAIL = "ada@example.com"
/** Wrong, but long enough to pass validation and reach the limiter. */
const WRONG_BUT_VALID = "wrong-but-long-enough"

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

const createUser = async () => {
  await db
    .insert(users)
    .values({ email: EMAIL, passwordHash: await hashPassword(PASSWORD) })
}

beforeEach(async () => {
  resetRateLimits()
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

describe("remembered sessions", () => {
  it("gives a remembered login the same session cookie lifetime", async () => {
    // As in Laravel: remembering does not lengthen the session, it adds a
    // second cookie that can start a new one later. The old version of this
    // test asserted the opposite and only passed on clock drift between the
    // two requests.
    await createUser()

    const normal = await post({ email: EMAIL, password: PASSWORD })
    const remembered = await post({
      email: EMAIL,
      password: PASSWORD,
      remember: true,
    })

    const normalExpiry = normal.cookies.get(SESSION_COOKIE_NAME)?.expires
    const rememberedExpiry =
      remembered.cookies.get(SESSION_COOKIE_NAME)?.expires
    expect(normalExpiry).toBeInstanceOf(Date)
    expect(rememberedExpiry).toBeInstanceOf(Date)
    expect(
      Math.abs(
        (rememberedExpiry as Date).getTime() - (normalExpiry as Date).getTime()
      )
    ).toBeLessThan(2000)
  })

  it("outlives the session with the recaller cookie, which is the point", async () => {
    await createUser()

    const response = await post({
      email: EMAIL,
      password: PASSWORD,
      remember: true,
    })

    const sessionExpiry = response.cookies.get(SESSION_COOKIE_NAME)?.expires
    const recallerAge = response.cookies.get(REMEMBER_COOKIE_NAME)?.maxAge
    expect(recallerAge).toBeGreaterThan(
      ((sessionExpiry as Date).getTime() - Date.now()) / 1000
    )
  })

  it("rejects a remember value that is not a boolean", async () => {
    const response = await post({
      email: EMAIL,
      password: PASSWORD,
      remember: "yes",
    })

    expect(response.status).toBe(400)
  })
})

describe("sessions that never expire", () => {
  it("gives the cookie the longest life a browser will honour", async () => {
    vi.spyOn(env, "SESSION_TTL_MINUTES", "get").mockReturnValue(null)
    await createUser()

    const response = await post({ email: EMAIL, password: PASSWORD })

    // Next derives `expires` from `maxAge` when the cookie is read back, so
    // the age is what the route actually set.
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(
      MAX_COOKIE_AGE_SECONDS
    )
  })

  it("outlasts an ordinary session by a wide margin", async () => {
    await createUser()
    const ordinary = await post({ email: EMAIL, password: PASSWORD })

    vi.spyOn(env, "SESSION_TTL_MINUTES", "get").mockReturnValue(null)
    const forever = await post({ email: EMAIL, password: PASSWORD })

    const ordinaryExpiry = ordinary.cookies.get(SESSION_COOKIE_NAME)?.expires
    const foreverExpiry = forever.cookies.get(SESSION_COOKIE_NAME)?.expires
    expect((foreverExpiry as Date).getTime()).toBeGreaterThan(
      (ordinaryExpiry as Date).getTime()
    )
  })

  it("stores no expiry on the row either, so the two agree", async () => {
    vi.spyOn(env, "SESSION_TTL_MINUTES", "get").mockReturnValue(null)
    await createUser()

    await post({ email: EMAIL, password: PASSWORD })

    const [row] = await db.select().from(sessions)
    expect(row.expiresAt).toBeNull()
  })
})

describe("POST /api/auth/login", () => {
  it("signs in with correct credentials and sets an httpOnly session cookie", async () => {
    await createUser()

    const response = await post({ email: EMAIL, password: PASSWORD })
    const body = await response.json()
    const cookie = response.cookies.get(SESSION_COOKIE_NAME)

    expect(response.status).toBe(200)
    expect(body.user.email).toBe(EMAIL)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe("lax")
    expect(cookie?.path).toBe("/")
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("never puts the session token or password hash in the body", async () => {
    await createUser()

    const response = await post({ email: EMAIL, password: PASSWORD })
    const token = response.cookies.get(SESSION_COOKIE_NAME)?.value
    const raw = JSON.stringify(await response.json())

    expect(raw).not.toContain(token)
    expect(raw).not.toContain("argon2")
    expect(raw).not.toContain("passwordHash")
  })

  it("accepts an email in a different case", async () => {
    await createUser()

    const response = await post({
      email: "ADA@Example.com  ",
      password: PASSWORD,
    })

    expect(response.status).toBe(200)
  })

  it("answers a wrong password and an unknown email identically", async () => {
    await createUser()

    const wrongPassword = await post({
      email: EMAIL,
      password: "wrong-password",
    })
    resetRateLimits()
    const unknownEmail = await post({
      email: "nobody@example.com",
      password: PASSWORD,
    })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json())
  })

  it("sets no cookie and creates no session when credentials are wrong", async () => {
    await createUser()

    const response = await post({ email: EMAIL, password: "wrong-password" })

    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined()
    await expect(db.select().from(sessions)).resolves.toEqual([])
  })

  it("rejects malformed JSON with 400 rather than crashing", async () => {
    const response = await post("{")

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("Malformed JSON body")
  })

  it("rejects a body that fails validation", async () => {
    const response = await post({ email: "not-an-email", password: "short" })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("Invalid request")
  })

  it("rejects an oversized body before parsing it", async () => {
    const response = await post(
      { email: EMAIL, password: PASSWORD },
      { "content-length": "999999" }
    )

    expect(response.status).toBe(413)
  })

  it("rate limits repeated attempts on one email and says when to retry", async () => {
    await createUser()

    const statuses: number[] = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push(
        (await post({ email: EMAIL, password: WRONG_BUT_VALID })).status
      )
    }
    const blocked = await post({ email: EMAIL, password: WRONG_BUT_VALID })

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0)
  })

  it("still refuses the correct password once the email is rate limited", async () => {
    await createUser()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await post({ email: EMAIL, password: WRONG_BUT_VALID })
    }

    const response = await post({ email: EMAIL, password: PASSWORD })

    expect(response.status).toBe(429)
  })
})
