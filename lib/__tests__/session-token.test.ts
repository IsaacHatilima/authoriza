import { describe, expect, it } from "vitest"

import { createSessionToken, hashSessionToken } from "@/lib/session-token"

describe("createSessionToken", () => {
  it("returns a url-safe token with 256 bits of entropy", () => {
    const token = createSessionToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("never repeats", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => createSessionToken())
    )

    expect(tokens.size).toBe(100)
  })
})

describe("hashSessionToken", () => {
  it("is deterministic so a cookie can be looked up by its digest", () => {
    const token = createSessionToken()

    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
  })

  it("differs per token", () => {
    expect(hashSessionToken(createSessionToken())).not.toBe(
      hashSessionToken(createSessionToken())
    )
  })

  it("never returns the token itself", () => {
    const token = createSessionToken()

    expect(hashSessionToken(token)).not.toBe(token)
  })
})
