import { describe, expect, it } from "vitest"

import {
  buildRecaller,
  createRememberToken,
  hashPasswordForCookie,
  parseRecaller,
  recallerMatches,
  secretsMatch,
} from "@/lib/remember"

const HASH = "$argon2id$v=19$m=19456,t=2,p=1$abc$def"
const USER = "6cd099b3-5183-4e79-85d7-dc9e8b84b724"

describe("createRememberToken", () => {
  it("is 60 characters, as Laravel's Str::random(60)", () => {
    expect(createRememberToken()).toHaveLength(60)
  })

  it("never repeats", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => createRememberToken())
    )
    expect(tokens.size).toBe(100)
  })
})

describe("buildRecaller and parseRecaller", () => {
  it("round-trips the three fields", () => {
    const token = createRememberToken()

    const parsed = parseRecaller(buildRecaller(USER, token, HASH))

    expect(parsed?.userId).toBe(USER)
    expect(parsed?.token).toBe(token)
    expect(parsed?.passwordHmac).toBe(hashPasswordForCookie(HASH))
  })

  it("never puts the password hash itself in the cookie", () => {
    expect(buildRecaller(USER, createRememberToken(), HASH)).not.toContain(HASH)
  })

  it.each(["", "onlyone", "two|parts", "a||c", "|b|c"])(
    "rejects the malformed value %s",
    (value) => {
      expect(parseRecaller(value)).toBeNull()
    }
  )

  it.each(["not-a-uuid", "12345", "6cd099b3-5183-4e79-85d7", "' OR 1=1 --"])(
    "rejects %s as a user id, which is a Postgres uuid column",
    (userId) => {
      expect(parseRecaller(`${userId}|token|hmac`)).toBeNull()
    }
  )

  it("rejects a missing cookie", () => {
    expect(parseRecaller(undefined)).toBeNull()
    expect(parseRecaller(null)).toBeNull()
  })
})

describe("secretsMatch", () => {
  it("accepts identical values and rejects different ones", () => {
    expect(secretsMatch("abc", "abc")).toBe(true)
    expect(secretsMatch("abc", "abd")).toBe(false)
  })

  it("rejects different lengths without throwing", () => {
    expect(secretsMatch("abc", "abcd")).toBe(false)
  })
})

describe("recallerMatches", () => {
  const token = createRememberToken()
  const recaller = parseRecaller(buildRecaller(USER, token, HASH))!

  it("accepts the token it was issued for", () => {
    expect(
      recallerMatches(recaller, { rememberToken: token, passwordHash: HASH })
    ).toBe(true)
  })

  it("rejects a user who has no token, which is how logout revokes", () => {
    expect(
      recallerMatches(recaller, { rememberToken: null, passwordHash: HASH })
    ).toBe(false)
  })

  it("rejects a cycled token", () => {
    expect(
      recallerMatches(recaller, {
        rememberToken: createRememberToken(),
        passwordHash: HASH,
      })
    ).toBe(false)
  })

  it("rejects once the password has changed", () => {
    // The whole point of the HMAC: a new password hash invalidates every
    // outstanding recaller, without the token being touched.
    expect(
      recallerMatches(recaller, {
        rememberToken: token,
        passwordHash: `${HASH}-changed`,
      })
    ).toBe(false)
  })
})
