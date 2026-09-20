"use client"

import type { ComponentProps } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

import { NAV_SECTIONS, NAV_SHORTCUTS } from "../../navigation"
import { BrandHeader } from "./BrandHeader"
import { NavMain } from "./NavMain"
import { NavShortcuts } from "./NavShortcuts"
import { NavUser } from "./NavUser"
import type { SessionUser } from "@/shared/session"

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  user: SessionUser
}

/** Composition only. Each region is its own component. */
export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <BrandHeader />
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={NAV_SECTIONS} />
        <NavShortcuts shortcuts={NAV_SHORTCUTS} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
