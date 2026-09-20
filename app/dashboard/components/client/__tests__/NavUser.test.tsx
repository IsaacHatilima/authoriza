// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/ui/sidebar"

import { NavUser } from "../NavUser"
import type { SessionUser } from "@/shared/session"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}))

const USER: SessionUser = {
  id: "u1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "admin",
  emailVerified: false,
}

const renderUser = (user: SessionUser = USER) =>
  render(
    <SidebarProvider>
      <NavUser user={user} />
    </SidebarProvider>
  )

afterEach(cleanup)

/**
 * The menu's contents are only reachable once the popup opens, which needs
 * layout that jsdom does not provide, so opening it is verified in a browser
 * instead. What is asserted here is this component's own logic: the trigger's
 * content and the initials it derives.
 */
describe("NavUser", () => {
  it("shows the name and the address, never the role", () => {
    renderUser()

    expect(screen.getByText("Ada Lovelace")).toBeDefined()
    expect(screen.getByText("ada@example.com")).toBeDefined()
    expect(screen.queryByText("admin")).toBeNull()
  })

  it("falls back to the address when there is no profile yet", () => {
    renderUser({ ...USER, name: null })

    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0)
  })

  it("derives initials from the name", () => {
    renderUser()

    expect(screen.getByText("AL")).toBeDefined()
  })

  it("derives initials from the address when there is no profile", () => {
    renderUser({ ...USER, name: null, email: "zoe@example.com" })

    expect(screen.getByText("ZO")).toBeDefined()
  })

  it("renders a menu trigger rather than a plain button", () => {
    renderUser()

    expect(screen.getByRole("button").getAttribute("aria-haspopup")).toBe(
      "menu"
    )
  })

  it("shows no role even for a different one", () => {
    renderUser({ ...USER, role: "hr" })

    expect(screen.queryByText("hr")).toBeNull()
  })
})
