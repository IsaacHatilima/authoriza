import { describe, expect, it } from "vitest"

import { parseEnv } from "@/lib/env"

const validSource = {
  DATABASE_URL: "postgres://postgres@127.0.0.1:5432/authoriza_dev",
  APP_SECRET: "a-secret-of-at-least-thirty-two-characters",
}

describe("session lifetimes", () => {
  it("defaults to a short session and a long remembered one", () => {
    const env = parseEnv(validSource)

    expect(env.SESSION_TTL_MINUTES).toBe(60)
    expect(env.SESSION_REMEMBER_TTL_MINUTES).toBe(576_000)
  })

  it("reads the values from the environment as numbers", () => {
    const env = parseEnv({
      ...validSource,
      SESSION_TTL_MINUTES: "15",
      SESSION_REMEMBER_TTL_MINUTES: "20160",
    })

    expect(env.SESSION_TTL_MINUTES).toBe(15)
    expect(env.SESSION_REMEMBER_TTL_MINUTES).toBe(20160)
  })

  it.each(["0", "-5", "12.5", "soon", ""])(
    "rejects %s as a session lifetime",
    (value) => {
      expect(() =>
        parseEnv({ ...validSource, SESSION_TTL_MINUTES: value })
      ).toThrowError(/SESSION_TTL_MINUTES/)
    }
  )

  it("rejects a lifetime beyond Laravel's 400-day ceiling", () => {
    expect(() =>
      parseEnv({ ...validSource, SESSION_REMEMBER_TTL_MINUTES: "576001" })
    ).toThrowError(/SESSION_REMEMBER_TTL_MINUTES/)
  })

  it("rejects a remembered session shorter than a normal one", () => {
    // Almost always a swap of the two values, and it would silently make
    // "remember me" sign people out sooner.
    expect(() =>
      parseEnv({
        ...validSource,
        SESSION_TTL_MINUTES: "120",
        SESSION_REMEMBER_TTL_MINUTES: "60",
      })
    ).toThrowError(/SESSION_REMEMBER_TTL_MINUTES/)
  })

  it.each(["null", "none", "never", "NULL", " null "])(
    "reads %s as a session that never expires",
    (value) => {
      const env = parseEnv({ ...validSource, SESSION_TTL_MINUTES: value })

      expect(env.SESSION_TTL_MINUTES).toBeNull()
    }
  )

  it("still requires a recaller lifetime when sessions never expire", () => {
    const env = parseEnv({
      ...validSource,
      SESSION_TTL_MINUTES: "null",
      SESSION_REMEMBER_TTL_MINUTES: "60",
    })

    // Nothing to be shorter than, so the usual ordering check is skipped
    // rather than rejecting a perfectly sensible pair.
    expect(env.SESSION_TTL_MINUTES).toBeNull()
    expect(env.SESSION_REMEMBER_TTL_MINUTES).toBe(60)
  })

  it("allows the two to be equal", () => {
    const env = parseEnv({
      ...validSource,
      SESSION_TTL_MINUTES: "60",
      SESSION_REMEMBER_TTL_MINUTES: "60",
    })

    expect(env.SESSION_REMEMBER_TTL_MINUTES).toBe(60)
  })
})

describe("APP_SECRET", () => {
  it("is required, because it keys the recaller's password HMAC", () => {
    const without: Record<string, string | undefined> = { ...validSource }
    delete without.APP_SECRET

    expect(() => parseEnv(without)).toThrowError(/APP_SECRET/)
  })

  it("rejects the placeholder from .env.example, long though it is", () => {
    // It passes min(32), so without an explicit check an app could ship using
    // an HMAC key that is published in this repository.
    expect(() =>
      parseEnv({
        ...validSource,
        APP_SECRET: "replace-me-with-32-or-more-random-characters",
      })
    ).toThrowError(/APP_SECRET/)
  })

  it("rejects a short secret", () => {
    expect(() =>
      parseEnv({ ...validSource, APP_SECRET: "too-short" })
    ).toThrowError(/APP_SECRET/)
  })
})

describe("parseEnv", () => {
  it("returns the validated variables", () => {
    const env = parseEnv(validSource)

    expect(env.DATABASE_URL).toBe(validSource.DATABASE_URL)
  })

  it("defaults NODE_ENV to development", () => {
    expect(parseEnv(validSource).NODE_ENV).toBe("development")
  })

  it("keeps an explicit NODE_ENV", () => {
    expect(parseEnv({ ...validSource, NODE_ENV: "test" }).NODE_ENV).toBe("test")
  })

  it("accepts the postgresql:// scheme", () => {
    const url = "postgresql://postgres@127.0.0.1:5432/authoriza_dev"

    expect(parseEnv({ ...validSource, DATABASE_URL: url }).DATABASE_URL).toBe(
      url
    )
  })

  it("fails when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrowError(/DATABASE_URL/)
  })

  it("fails when DATABASE_URL is not a Postgres URL", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "mysql://root@127.0.0.1:3306/app" })
    ).toThrowError(/DATABASE_URL/)
  })

  it("fails when NODE_ENV is not a known environment", () => {
    expect(() =>
      parseEnv({ ...validSource, NODE_ENV: "staging" })
    ).toThrowError(/NODE_ENV/)
  })

  it("does not mutate the source object", () => {
    const source = { ...validSource }

    parseEnv(source)

    expect(source).toEqual(validSource)
  })
})
