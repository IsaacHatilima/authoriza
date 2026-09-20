import { describe, expect, it } from "vitest"

import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "@/lib/password"

describe("hashPassword", () => {
  it("produces an argon2id PHC string", async () => {
    const hash = await hashPassword("correct horse battery staple")

    expect(hash).toMatch(/^\$argon2id\$v=19\$/)
  })

  it("salts, so the same password hashes differently each time", async () => {
    const [first, second] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ])

    expect(first).not.toBe(second)
  })
})

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    const hash = await hashPassword("correct horse battery staple")

    await expect(
      verifyPassword(hash, "correct horse battery staple")
    ).resolves.toBe(true)
  })

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple")

    await expect(verifyPassword(hash, "wrong")).resolves.toBe(false)
  })

  it("returns false rather than throwing on a malformed hash", async () => {
    // @node-rs/argon2 throws "Decoding failed" on a non-PHC string. Letting
    // that escape would turn a 401 into a 500 and leak which accounts exist.
    await expect(verifyPassword("not-a-hash", "anything")).resolves.toBe(false)
  })

  it("returns false on an empty stored hash", async () => {
    await expect(verifyPassword("", "anything")).resolves.toBe(false)
  })
})

describe("DUMMY_PASSWORD_HASH", () => {
  it("is a real argon2id hash so the unknown-user path costs the same", () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$argon2id\$v=19\$/)
  })

  it("verifies as false without throwing", async () => {
    await expect(
      verifyPassword(DUMMY_PASSWORD_HASH, "any password at all")
    ).resolves.toBe(false)
  })
})
