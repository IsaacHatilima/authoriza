// @vitest-environment jsdom
import type { ReactNode } from "react"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/ui/sidebar"

import { NAV_SECTIONS, NAV_SHORTCUTS } from "../../navigation"
import { AppSidebar } from "../client/AppSidebar"
import { BrandHeader } from "../client/BrandHeader"
import { NavShortcuts } from "../client/NavShortcuts"
import { AccountSummary } from "../server/AccountSummary"
import { DashboardHeader } from "../server/DashboardHeader"
import type { SessionUser } from "@/shared/session"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}))

const USER: SessionUser = {
  id: "u1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "hr",
  emailVerified: true,
}

const inSidebar = (node: ReactNode) =>
  render(<SidebarProvider>{node}</SidebarProvider>)

afterEach(cleanup)

describe("BrandHeader", () => {
  it("names the product and links to the dashboard", () => {
    inSidebar(<BrandHeader />)

    expect(screen.getByText("Authoriza")).toBeDefined()
    expect(screen.getByRole("link")).toHaveProperty("pathname", "/dashboard")
  })
})

describe("NavShortcuts", () => {
  it("renders one link per shortcut", () => {
    inSidebar(<NavShortcuts shortcuts={NAV_SHORTCUTS} />)

    expect(screen.getAllByRole("link")).toHaveLength(NAV_SHORTCUTS.length)
  })

  it("renders nothing but the group when given no shortcuts", () => {
    inSidebar(<NavShortcuts shortcuts={[]} />)

    expect(screen.queryAllByRole("link")).toHaveLength(0)
  })
})

describe("AppSidebar", () => {
  it("composes the brand, every nav section and the signed-in user", () => {
    inSidebar(<AppSidebar user={USER} />)

    expect(screen.getByText("Authoriza")).toBeDefined()
    for (const section of NAV_SECTIONS) {
      expect(screen.getByText(section.title)).toBeDefined()
    }
    expect(screen.getByText("Dashboard")).toBeDefined()
    expect(screen.getByText(USER.email)).toBeDefined()
  })
})

describe("DashboardHeader", () => {
  it("shows the page title", () => {
    inSidebar(<DashboardHeader title="Overview" />)

    expect(screen.getByText("Overview")).toBeDefined()
  })
})

describe("AccountSummary", () => {
  it("lists the account the session belongs to", () => {
    render(<AccountSummary user={USER} />)

    expect(screen.getByText("Ada Lovelace")).toBeDefined()
    expect(screen.getByText("ada@example.com")).toBeDefined()
    expect(screen.getByText("hr")).toBeDefined()
    expect(screen.getByText("yes")).toBeDefined()
  })

  it("says when no profile has been created", () => {
    render(<AccountSummary user={{ ...USER, name: null }} />)

    expect(screen.getByText("Not set")).toBeDefined()
  })

  it("says when the email is unverified", () => {
    render(<AccountSummary user={{ ...USER, emailVerified: false }} />)

    expect(screen.getByText("no")).toBeDefined()
  })
})
