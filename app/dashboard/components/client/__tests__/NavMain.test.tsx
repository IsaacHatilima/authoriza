// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/ui/sidebar"

import { type NavSection, NAV_SECTIONS } from "../../../navigation"
import { NavMain } from "../NavMain"

/** Mutable so each test can pretend to be on a different route. */
const route = vi.hoisted(() => ({ pathname: "/dashboard" }))
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }))

/** Only sections with children collapse; Dashboard is a plain link. */
const COLLAPSIBLE = NAV_SECTIONS.filter((section) => section.items?.length)

const renderNav = (sections: readonly NavSection[] = NAV_SECTIONS) =>
  render(
    <SidebarProvider>
      <NavMain sections={sections} />
    </SidebarProvider>
  )

/**
 * The shipped nav points at "#" for everything but the dashboard, because
 * those pages do not exist yet. Section highlighting is a property of the
 * component, so it is exercised against real routes here.
 */
const ROUTED: readonly NavSection[] = [
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

/** base-ui writes data-active with no value, and omits it when inactive. */
const isActive = (element: HTMLElement) => element.hasAttribute("data-active")

const trigger = (title: string) =>
  screen.getByRole("button", { name: new RegExp(title, "i") })

const isOpen = (title: string) =>
  trigger(title).getAttribute("aria-expanded") === "true"

beforeEach(() => {
  route.pathname = "/dashboard"
})

afterEach(cleanup)

describe("NavMain", () => {
  it("renders every collapsible section", () => {
    renderNav()

    for (const section of COLLAPSIBLE) {
      expect(trigger(section.title)).toBeDefined()
    }
  })

  it("renders a childless section as a plain link, not a collapsible", () => {
    renderNav()

    const dashboard = screen.getByRole("link", { name: /dashboard/i })
    expect(dashboard).toHaveProperty("pathname", "/dashboard")
    expect(screen.queryByRole("button", { name: /dashboard/i })).toBeNull()
  })
})

describe("active state", () => {
  it("marks the entry for the current route", () => {
    renderNav()

    expect(isActive(screen.getByRole("link", { name: /dashboard/i }))).toBe(
      true
    )
  })

  it("leaves every other section inactive", () => {
    renderNav()

    for (const section of COLLAPSIBLE) {
      expect(isActive(trigger(section.title))).toBe(false)
    }
  })

  it("marks a section active when the page is one of its children", () => {
    route.pathname = "/people/directory"
    renderNav(ROUTED)

    expect(isActive(trigger("People"))).toBe(true)
    expect(isActive(trigger("Access"))).toBe(false)
  })

  it("does not mark the dashboard active on another page", () => {
    route.pathname = "/people/directory"
    renderNav(ROUTED)

    expect(isActive(screen.getByRole("link", { name: /dashboard/i }))).toBe(
      false
    )
  })
})

describe("which section starts open", () => {
  it("opens nothing on a page that belongs to no section", () => {
    renderNav()

    expect(COLLAPSIBLE.every((section) => !isOpen(section.title))).toBe(true)
  })

  it("opens the section containing the current page", () => {
    route.pathname = "/people/directory"
    renderNav(ROUTED)

    expect(isOpen("People")).toBe(true)
    expect(isOpen("Access")).toBe(false)
  })

  it("opens nothing when every entry is still a placeholder", () => {
    route.pathname = "/dashboard"
    renderNav()

    expect(COLLAPSIBLE.every((section) => !isOpen(section.title))).toBe(true)
  })
})

describe("accordion behaviour", () => {
  it("opens a section when its trigger is clicked", async () => {
    renderNav()
    const user = userEvent.setup()

    await user.click(trigger("People"))

    expect(isOpen("People")).toBe(true)
  })

  it("closes the open section when another is opened", async () => {
    renderNav()
    const user = userEvent.setup()

    await user.click(trigger("People"))
    await user.click(trigger("Access"))

    expect(isOpen("Access")).toBe(true)
    expect(isOpen("People")).toBe(false)
  })

  it("never leaves two open, whichever order they are clicked", async () => {
    renderNav()
    const user = userEvent.setup()

    for (const section of COLLAPSIBLE) {
      await user.click(trigger(section.title))
      expect(COLLAPSIBLE.filter((s) => isOpen(s.title))).toHaveLength(1)
    }
  })

  it("closes a section when its own trigger is clicked again", async () => {
    renderNav()
    const user = userEvent.setup()

    await user.click(trigger("People"))
    await user.click(trigger("People"))

    expect(isOpen("People")).toBe(false)
  })

  it("shows the sub-items of the open section", async () => {
    renderNav()
    const user = userEvent.setup()

    await user.click(trigger("Access"))

    expect(screen.getByText("Audit log")).toBeDefined()
  })
})
