import { NextRequest } from "next/server"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { SESSION_COOKIE_NAME } from "@/lib/cookies"
import { sessionService } from "@/shared/session"

import { db, pool } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"
import { hashPassword } from "@/lib/password"
import { REMEMBER_COOKIE_NAME } from "@/lib/cookies"
import { sessionExpiresAt } from "@/lib/session-lifetime"
import { createSessionToken, hashSessionToken } from "@/lib/session-token"

import { POST } from "../route"

const post = (token?: string) =>
  POST(
    new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
    })
  )

const signIn = async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: "ada@example.com",
      passwordHash: await hashPassword("a-good-password"),
    })
    .returning()
  const token = createSessionToken()
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: sessionExpiresAt(),
  })
  return token
}

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(profiles)
  await db.delete(users)
})

afterAll(async () => {
  await pool.end()
})

describe("POST /api/auth/logout", () => {
  it("revokes the session so the token stops working", async () => {
    const token = await signIn()

    const response = await post(token)

    expect(response.status).toBe(200)
    await expect(sessionService.findByToken(token)).resolves.toBeNull()
  })

  it("clears the cookie in the browser", async () => {
    const token = await signIn()

    const response = await post(token)
    const cookie = response.cookies.get(SESSION_COOKIE_NAME)

    expect(cookie?.value).toBe("")
    expect(cookie?.maxAge).toBe(0)
    expect(cookie?.httpOnly).toBe(true)
  })

  it("forgets the device, so no recaller can revive the account", async () => {
    const token = await signIn()
    await db.update(users).set({ rememberToken: "a-remember-token" })

    await post(token)

    const [user] = await db.select().from(users)
    expect(user.rememberToken).toBeNull()
  })

  it("clears the recaller cookie as well as the session one", async () => {
    const token = await signIn()

    const response = await post(token)

    expect(response.cookies.get(REMEMBER_COOKIE_NAME)?.maxAge).toBe(0)
  })

  it("keeps the row for the audit trail", async () => {
    const token = await signIn()

    await post(token)

    const [row] = await db.select().from(sessions)
    expect(row.revokedAt).toBeInstanceOf(Date)
  })

  it("succeeds when there is no session cookie at all", async () => {
    const response = await post()

    expect(response.status).toBe(200)
  })

  it("succeeds for a token that was never issued", async () => {
    const response = await post(createSessionToken())

    expect(response.status).toBe(200)
  })

  it("is idempotent", async () => {
    const token = await signIn()

    const first = await post(token)
    const second = await post(token)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  it("leaves another device signed in", async () => {
    const token = await signIn()
    const [user] = await db.select().from(users)
    const other = createSessionToken()
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: hashSessionToken(other),
      expiresAt: sessionExpiresAt(),
    })

    await post(token)

    await expect(sessionService.findByToken(other)).resolves.not.toBeNull()
  })
})
