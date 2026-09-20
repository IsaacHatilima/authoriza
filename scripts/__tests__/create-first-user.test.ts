import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { db, pool } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"
import { verifyPassword } from "@/lib/password"

import {
  BootstrapError,
  createFirstUser,
  parseArgs,
  parseFirstUserInput,
} from "../create-first-user"

const VALID = {
  email: "Ada@Example.com",
  password: "a-long-enough-password",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "admin",
}

beforeEach(async () => {
  await db.delete(sessions)
  await db.delete(profiles)
  await db.delete(users)
})

afterAll(async () => {
  await pool.end()
})

describe("parseArgs", () => {
  it("reads --flag value and --flag=value alike", () => {
    expect(parseArgs(["--email", "a@b.co", "--role=admin"])).toEqual({
      email: "a@b.co",
      role: "admin",
    })
  })

  it("converts kebab-case flags to camelCase keys", () => {
    expect(parseArgs(["--first-name", "Ada"])).toEqual({ firstName: "Ada" })
  })

  it("ignores stray positional arguments", () => {
    expect(parseArgs(["junk", "--role", "hr"])).toEqual({ role: "hr" })
  })
})

describe("parseFirstUserInput", () => {
  it("normalises the email to lowercase", () => {
    expect(parseFirstUserInput(VALID).email).toBe("ada@example.com")
  })

  it("defaults the role to hr", () => {
    expect(parseFirstUserInput({ ...VALID, role: undefined }).role).toBe("hr")
  })

  it.each(["", "not-an-email", "a@b"])("rejects %s as an email", (email) => {
    expect(() => parseFirstUserInput({ ...VALID, email })).toThrowError(
      BootstrapError
    )
  })

  it("rejects a password shorter than twelve characters", () => {
    expect(() =>
      parseFirstUserInput({ ...VALID, password: "short" })
    ).toThrowError(/at least 12/)
  })

  it("rejects an unknown role", () => {
    expect(() =>
      parseFirstUserInput({ ...VALID, role: "superuser" })
    ).toThrowError(/not a role/)
  })

  it("requires both names", () => {
    expect(() =>
      parseFirstUserInput({ ...VALID, lastName: "  " })
    ).toThrowError(/first name and a last name/)
  })
})

describe("createFirstUser", () => {
  it("creates the user with the requested role", async () => {
    const created = await createFirstUser(parseFirstUserInput(VALID))

    expect(created.email).toBe("ada@example.com")
    expect(created.role).toBe("admin")
  })

  it("stores the password as an argon2id hash that verifies", async () => {
    await createFirstUser(parseFirstUserInput(VALID))

    const [user] = await db.select().from(users)
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$/)
    await expect(
      verifyPassword(user.passwordHash, VALID.password)
    ).resolves.toBe(true)
  })

  it("creates the matching profile", async () => {
    const created = await createFirstUser(parseFirstUserInput(VALID))

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, created.id))
    expect(profile.firstName).toBe("Ada")
    expect(profile.lastName).toBe("Lovelace")
  })

  it("refuses once any user exists", async () => {
    await createFirstUser(parseFirstUserInput(VALID))

    await expect(
      createFirstUser(
        parseFirstUserInput({ ...VALID, email: "second@example.com" })
      )
    ).rejects.toThrowError(/only bootstraps an empty database/)
  })

  it("leaves no user behind when the profile cannot be written", async () => {
    const input = parseFirstUserInput({ ...VALID, firstName: "x".repeat(10) })
    // Force the second statement to fail inside the transaction.
    await db.execute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "alter table profiles add constraint tmp_no_x check (first_name <> 'xxxxxxxxxx')" as any
    )

    await expect(createFirstUser(input)).rejects.toThrow()
    await expect(db.select().from(users)).resolves.toEqual([])

    await db.execute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "alter table profiles drop constraint tmp_no_x" as any
    )
  })
})
