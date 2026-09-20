"use client"

import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { isActivePath, type NavShortcut } from "../../navigation"

interface NavShortcutsProps {
  shortcuts: readonly NavShortcut[]
}

/** Flat links, no sub-items, so nothing here collapses. */
export function NavShortcuts({ shortcuts }: NavShortcutsProps) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
      <SidebarMenu>
        {shortcuts.map((shortcut) => (
          <SidebarMenuItem key={shortcut.name}>
            <SidebarMenuButton
              tooltip={shortcut.name}
              isActive={isActivePath(pathname, shortcut.url)}
              render={<a href={shortcut.url} />}
            >
              {shortcut.icon}
              <span>{shortcut.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
