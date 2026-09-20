// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { THEMES, ThemeMenu } from "../ThemeMenu"

const themeState = vi.hoisted(() => ({
  theme: "system" as string | undefined,
  setTheme: vi.fn(),
}))
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: themeState.theme, setTheme: themeState.setTheme }),
}))

/** The menu only renders its items when open, so open it from the start. */
const renderMenu = () =>
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>account</DropdownMenuTrigger>
      <DropdownMenuContent>
        <ThemeMenu />
      </DropdownMenuContent>
    </DropdownMenu>
  )

const option = (label: string) =>
  screen.getByRole("menuitemradio", { name: new RegExp(label, "i") })

beforeEach(() => {
  themeState.theme = "system"
  themeState.setTheme.mockReset()
})

afterEach(cleanup)

describe("ThemeMenu", () => {
  it("offers light, dark and system", () => {
    renderMenu()

    expect(THEMES.map((t) => t.value)).toEqual(["light", "dark", "system"])
    for (const { label } of THEMES) {
      expect(option(label)).toBeDefined()
    }
  })

  it("names each icon-only option for assistive tech", () => {
    renderMenu()

    for (const { label } of THEMES) {
      expect(option(label).getAttribute("aria-label")).toBe(label)
    }
  })

  it("ticks the stored preference", () => {
    themeState.theme = "dark"
    renderMenu()

    expect(option("Dark").getAttribute("aria-checked")).toBe("true")
    expect(option("Light").getAttribute("aria-checked")).toBe("false")
  })

  it("falls back to system when nothing is stored", () => {
    themeState.theme = undefined
    renderMenu()

    expect(option("System").getAttribute("aria-checked")).toBe("true")
  })

  it.each(THEMES.map((t) => [t.label, t.value]))(
    "chooses %s",
    async (label, value) => {
      renderMenu()
      const user = userEvent.setup()

      await user.click(option(label))

      expect(themeState.setTheme).toHaveBeenCalledWith(value)
    }
  )
})
