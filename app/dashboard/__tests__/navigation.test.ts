import { describe, expect, it } from "vitest"

import { isActivePath, type NavSection, sectionForPath } from "../navigation"

describe("isActivePath", () => {
  it("matches the exact route", () => {
    expect(isActivePath("/dashboard", "/dashboard")).toBe(true)
  })

  it("matches a nested route, so a parent stays highlighted", () => {
    expect(isActivePath("/dashboard/reports", "/dashboard")).toBe(true)
  })

  it("does not match a route that merely shares a prefix", () => {
    expect(isActivePath("/dashboard-archive", "/dashboard")).toBe(false)
  })

  it("does not match a different route", () => {
    expect(isActivePath("/auth/login", "/dashboard")).toBe(false)
  })

  it.each(["#", ""])("never matches the placeholder %s", (url) => {
    expect(isActivePath("/dashboard", url)).toBe(false)
  })

  it("tolerates a trailing slash on the entry", () => {
    expect(isActivePath("/dashboard/reports", "/dashboard/")).toBe(true)
  })
})

describe("sectionForPath", () => {
  const sections: NavSection[] = [
    { title: "Dashboard", url: "/dashboard", icon: null },
    {
      title: "People",
      url: "#",
      icon: null,
      items: [{ title: "Directory", url: "/people/directory" }],
    },
    {
      title: "Access",
      url: "#",
      icon: null,
      items: [{ title: "Roles", url: "/access/roles" }],
    },
  ]

  it("finds the section holding the current page", () => {
    expect(sectionForPath(sections, "/access/roles")).toBe("Access")
  })

  it("finds it from a nested route", () => {
    expect(sectionForPath(sections, "/people/directory/42")).toBe("People")
  })

  it("returns null when no section matches", () => {
    expect(sectionForPath(sections, "/dashboard")).toBeNull()
  })

  it("ignores sections with no children", () => {
    expect(sectionForPath([sections[0]], "/dashboard")).toBeNull()
  })
})
