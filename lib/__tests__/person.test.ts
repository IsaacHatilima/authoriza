import { describe, expect, it } from "vitest"

import { fullName, initialsFor } from "@/lib/person"

describe("fullName", () => {
  it("joins the two parts", () => {
    expect(fullName("Ada", "Lovelace")).toBe("Ada Lovelace")
  })

  it("trims stray whitespace", () => {
    expect(fullName("  Ada ", " Lovelace ")).toBe("Ada Lovelace")
  })

  it("copes with only one part", () => {
    expect(fullName("Ada", null)).toBe("Ada")
    expect(fullName(null, "Lovelace")).toBe("Lovelace")
  })

  it("is null when there is no profile", () => {
    expect(fullName(null, null)).toBeNull()
    expect(fullName(undefined, undefined)).toBeNull()
  })

  it("is null rather than blank for empty strings", () => {
    expect(fullName("", "   ")).toBeNull()
  })
})

describe("initialsFor", () => {
  it("takes the first and last initial", () => {
    expect(initialsFor("Ada Lovelace", "ada@example.com")).toBe("AL")
  })

  it("skips middle names", () => {
    expect(initialsFor("Ada King Lovelace", "a@b.co")).toBe("AL")
  })

  it("uses two letters of a single name", () => {
    expect(initialsFor("Ada", "a@b.co")).toBe("AD")
  })

  it("falls back to the address when there is no name", () => {
    expect(initialsFor(null, "zoe@example.com")).toBe("ZO")
  })

  it("uppercases whatever it finds", () => {
    expect(initialsFor("ada lovelace", "a@b.co")).toBe("AL")
  })
})
