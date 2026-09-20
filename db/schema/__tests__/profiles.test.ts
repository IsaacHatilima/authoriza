import { getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { profiles } from "@/db/schema"

const config = getTableConfig(profiles)
const column = (name: string) => {
  const found = config.columns.find((c) => c.name === name)
  if (!found) throw new Error(`profiles has no column "${name}"`)
  return found
}

describe("profiles table", () => {
  it("is named profiles", () => {
    expect(config.name).toBe("profiles")
  })

  it("has a uuid primary key with a generated default", () => {
    const id = column("id")

    expect(id.primary).toBe(true)
    expect(id.getSQLType()).toBe("uuid")
    expect(id.hasDefault).toBe(true)
  })

  it("requires a user_id uuid", () => {
    const userId = column("user_id")

    expect(userId.notNull).toBe(true)
    expect(userId.getSQLType()).toBe("uuid")
  })

  it("keeps user_id unique so each user has at most one profile", () => {
    expect(column("user_id").isUnique).toBe(true)
  })

  it("references users.id and cascades on delete", () => {
    const fk = config.foreignKeys.find((key) =>
      key.reference().columns.some((c) => c.name === "user_id")
    )
    if (!fk) throw new Error("profiles.user_id has no foreign key")
    const reference = fk.reference()

    expect(getTableName(reference.foreignTable)).toBe("users")
    expect(reference.foreignColumns.map((c) => c.name)).toEqual(["id"])
    expect(fk.onDelete).toBe("cascade")
  })

  it("requires first and last names", () => {
    expect(column("first_name").notNull).toBe(true)
    expect(column("last_name").notNull).toBe(true)
  })

  it("keeps avatar_url optional", () => {
    expect(column("avatar_url").notNull).toBe(false)
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
