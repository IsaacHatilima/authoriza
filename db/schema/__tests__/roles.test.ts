import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { users, userRoleEnum } from "@/db/schema"
import { DEFAULT_USER_ROLE, isUserRole, USER_ROLES } from "@/lib/roles"

const column = getTableConfig(users).columns.find((c) => c.name === "role")

describe("user roles", () => {
  it("offers exactly admin and hr", () => {
    expect(USER_ROLES).toEqual(["admin", "hr"])
  })

  it("defaults to the least privileged role", () => {
    expect(DEFAULT_USER_ROLE).toBe("hr")
  })

  it("recognises known roles and rejects others", () => {
    expect(isUserRole("admin")).toBe(true)
    expect(isUserRole("hr")).toBe(true)
    expect(isUserRole("superuser")).toBe(false)
    expect(isUserRole("")).toBe(false)
  })

  it("is a database enum, not free text", () => {
    expect(userRoleEnum.enumName).toBe("user_role")
    expect(userRoleEnum.enumValues).toEqual(["admin", "hr"])
    expect(column?.getSQLType()).toBe("user_role")
  })

  it("is required on users and defaults to hr", () => {
    expect(column?.notNull).toBe(true)
    expect(column?.hasDefault).toBe(true)
    expect(column?.default).toBe("hr")
  })
})
