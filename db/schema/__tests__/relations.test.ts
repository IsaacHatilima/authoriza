import { createTableRelationsHelpers, getTableName, is, One } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { profiles, profilesRelations, users, usersRelations } from "@/db/schema"

describe("users <-> profiles relations", () => {
  it("users exposes a one-to-one profile relation", () => {
    const relations = usersRelations.config(createTableRelationsHelpers(users))
    const relation = relations.profile

    expect(is(relation, One)).toBe(true)
    expect(getTableName(relation.referencedTable)).toBe("profiles")
  })

  it("profiles exposes a user relation keyed on user_id -> users.id", () => {
    const relations = profilesRelations.config(
      createTableRelationsHelpers(profiles)
    )
    const relation = relations.user

    expect(is(relation, One)).toBe(true)
    expect(getTableName(relation.referencedTable)).toBe("users")
    expect(relation.config?.fields.map((f) => f.name)).toEqual(["user_id"])
    expect(relation.config?.references.map((f) => f.name)).toEqual(["id"])
  })
})
