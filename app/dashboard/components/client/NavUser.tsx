"use client"

import { useRouter } from "next/navigation"
import { BadgeCheckIcon, ChevronsUpDownIcon, LogOutIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLogout } from "@/app/auth/logout/hooks/Logout.hook"

import { ThemeMenu } from "./ThemeMenu"
import { initialsFor } from "@/lib/person"
import type { SessionUser } from "@/shared/session"

interface NavUserProps {
  user: SessionUser
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { logout, loading } = useLogout({
    onSuccess: () => {
      router.push("/auth/login")
      router.refresh()
    },
  })

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarFallback>
                {initialsFor(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              {/* A role is an internal fact, not something to show someone
                  about themselves. Name and address identify the account. */}
              <span className="truncate font-medium">
                {user.name ?? user.email}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* Base UI requires a label to sit inside a group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>
                      {initialsFor(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user.name ?? user.email}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <BadgeCheckIcon />
                {user.emailVerified ? "Email verified" : "Email not verified"}
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <ThemeMenu />

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={loading}
                onClick={() => void logout()}
              >
                <LogOutIcon />
                {loading ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
