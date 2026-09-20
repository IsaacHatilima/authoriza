import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { users } from "@/db/schema"

const config = getTableConfig(users)
const column = (name: string) => {
  const found = config.columns.find((c) => c.name === name)
  if (!found) throw new Error(`users has no column "${name}"`)
  return found
}

describe("users table", () => {
  it("is named users", () => {
    expect(config.name).toBe("users")
  })

  it("has a uuid primary key with a generated default", () => {
    const id = column("id")

    expect(id.primary).toBe(true)
    expect(id.getSQLType()).toBe("uuid")
    expect(id.hasDefault).toBe(true)
  })

  it("requires a unique email", () => {
    const email = column("email")

    expect(email.notNull).toBe(true)
    expect(email.isUnique).toBe(true)
  })

  it("requires a password hash", () => {
    expect(column("password_hash").notNull).toBe(true)
  })

  it("keeps email verification optional", () => {
    const verifiedAt = column("email_verified_at")

    expect(verifiedAt.notNull).toBe(false)
    expect(verifiedAt.getSQLType()).toBe("timestamp with time zone")
  })

  it.each(["created_at", "updated_at"])(
    "has a non-null %s timestamp with a default",
    (name) => {
      const col = column(name)

      expect(col.notNull).toBe(true)
      expect(col.hasDefault).toBe(true)
      expect(col.getSQLType()).toBe("timestamp with time zone")
    }
  )

  it("refreshes updated_at through Drizzle but never created_at", () => {
    expect(column("updated_at").onUpdateFn).toBeTypeOf("function")
    expect(column("created_at").onUpdateFn).toBeUndefined()
  })
})
