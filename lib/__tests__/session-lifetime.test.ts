import { afterEach, describe, expect, it, vi } from "vitest"

import { env } from "@/lib/env"
import {
  MS_PER_MINUTE,
  rememberTtlMs,
  sessionExpiresAt,
  sessionTtlMs,
} from "@/lib/session-lifetime"

/** The test environment configures an expiring session; some tests need the other mode. */
const withNeverExpiringSessions = () =>
  vi.spyOn(env, "SESSION_TTL_MINUTES", "get").mockReturnValue(null)

/** Narrows for the tests that only make sense when sessions do expire. */
const minutes = (): number => {
  const value = env.SESSION_TTL_MINUTES
  if (value === null) throw new Error("expected an expiring session")
  return value
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("MS_PER_MINUTE", () => {
  it("converts minutes to milliseconds", () => {
    expect(MS_PER_MINUTE).toBe(60_000)
  })
})

describe("sessionTtlMs", () => {
  it("returns the session lifetime in milliseconds", () => {
    expect(sessionTtlMs()).toBe(minutes() * MS_PER_MINUTE)
  })

  it("returns whole milliseconds", () => {
    expect(Number.isInteger(sessionTtlMs())).toBe(true)
  })

  it("returns null when sessions are configured never to expire", () => {
    withNeverExpiringSessions()

    expect(sessionTtlMs()).toBeNull()
  })
})

describe("sessionExpiresAt", () => {
  it("is the configured lifetime from now", () => {
    const before = Date.now()

    const expiresAt = sessionExpiresAt()

    expect(expiresAt).not.toBeNull()
    expect(
      Math.round(((expiresAt as Date).getTime() - before) / MS_PER_MINUTE)
    ).toBe(minutes())
  })

  it("is null when sessions never expire, rather than a far-off date", () => {
    withNeverExpiringSessions()

    expect(sessionExpiresAt()).toBeNull()
  })
})

describe("rememberTtlMs", () => {
  it("returns the recaller lifetime in milliseconds", () => {
    expect(rememberTtlMs()).toBe(
      env.SESSION_REMEMBER_TTL_MINUTES * MS_PER_MINUTE
    )
  })

  it("outlives a session, which is the point of remembering", () => {
    expect(rememberTtlMs()).toBeGreaterThan(minutes() * MS_PER_MINUTE)
  })
})
