import { describe, expect, it } from "vitest"

import {
  MAX_COOKIE_AGE_SECONDS,
  REMEMBER_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionCookieLifetime,
} from "@/lib/cookies"

describe("cookie names", () => {
  it("are distinct, so one never overwrites the other", () => {
    expect(SESSION_COOKIE_NAME).not.toBe(REMEMBER_COOKIE_NAME)
  })
})

describe("MAX_COOKIE_AGE_SECONDS", () => {
  it("is the 400 days browsers cap a cookie at", () => {
    expect(MAX_COOKIE_AGE_SECONDS).toBe(400 * 24 * 60 * 60)
  })
})

describe("sessionCookieLifetime", () => {
  it("expires with the session when the session expires", () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z")

    expect(sessionCookieLifetime(expiresAt)).toEqual({ expires: expiresAt })
  })

  it("lasts as long as a browser allows when the session never expires", () => {
    expect(sessionCookieLifetime(null)).toEqual({
      maxAge: MAX_COOKIE_AGE_SECONDS,
    })
  })

  it("never returns both, which browsers resolve in favour of maxAge", () => {
    // Passing both would make the cookie outlive the row it mirrors.
    for (const value of [new Date(), null]) {
      expect(Object.keys(sessionCookieLifetime(value))).toHaveLength(1)
    }
  })
})
