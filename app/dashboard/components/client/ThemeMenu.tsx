"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

export const THEMES = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const

/** Matches ThemeProvider's defaultTheme. */
const FALLBACK_THEME = "system"

// The stored preference lives in localStorage, which the server cannot read.
// Reading it as a store snapshot rather than in an effect keeps the first
// paint identical on both sides and avoids briefly ticking the wrong option.
const subscribe = () => () => {}
const onClient = () => true
const onServer = () => false

/**
 * The theme picker inside the account menu.
 *
 * A radio group rather than a toggle, because "system" is a third choice
 * rather than a state between the other two: it follows the operating system
 * and changes with it.
 */
export function ThemeMenu() {
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer)
  const { theme, setTheme } = useTheme()
  const selected = hydrated ? (theme ?? FALLBACK_THEME) : FALLBACK_THEME

  return (
    <DropdownMenuRadioGroup
      className="flex flex-row items-center justify-center"
      value={selected}
      onValueChange={(value) => setTheme(String(value))}
    >
      {/*
        Icon only by design, so each option carries its name for screen
        readers and its tooltip for everyone else. Without this the three
        choices are announced as nothing at all.
      */}
      {THEMES.map(({ value, label, Icon }) => (
        <DropdownMenuRadioItem
          key={value}
          value={value}
          aria-label={label}
          title={label}
        >
          <Icon />
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}
