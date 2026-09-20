import {
  BuildingIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"
import type { ReactNode } from "react"

export interface NavLink {
  title: string
  url: string
}

export interface NavSection {
  title: string
  url: string
  icon: ReactNode
  /** Omit for a plain link. Only sections with children collapse. */
  items?: NavLink[]
}

export interface NavShortcut {
  name: string
  url: string
  icon: ReactNode
}

/**
 * The sidebar tree. Data, not markup, so the components stay presentational
 * and this is the one place a route is added or renamed.
 *
 * Entries pointing at "#" are placeholders for pages that do not exist yet.
 * Only /dashboard is real today.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "People",
    url: "#",
    icon: <UsersIcon />,
    items: [
      { title: "Directory", url: "#" },
      { title: "Onboarding", url: "#" },
      { title: "Offboarding", url: "#" },
    ],
  },
  {
    title: "Access",
    url: "#",
    icon: <KeyRoundIcon />,
    items: [
      { title: "Roles", url: "#" },
      { title: "Sessions", url: "#" },
      { title: "Audit log", url: "#" },
    ],
  },
  {
    title: "Organisation",
    url: "#",
    icon: <BuildingIcon />,
    items: [
      { title: "Departments", url: "#" },
      { title: "Locations", url: "#" },
    ],
  },
  {
    title: "Settings",
    url: "#",
    icon: <SettingsIcon />,
    items: [
      { title: "General", url: "#" },
      { title: "Authentication", url: "#" },
    ],
  },
]

export const NAV_SHORTCUTS: readonly NavShortcut[] = [
  { name: "Provisioning", url: "#", icon: <ShieldCheckIcon /> },
]

/** Placeholder hrefs are never the current page. */
const PLACEHOLDER = "#"

/**
 * Whether a nav entry points at the page being viewed.
 *
 * A nested route counts as active for its parent, so /dashboard/reports keeps
 * Dashboard highlighted, but /dashboard-archive does not: the boundary has to
 * be a path separator, not a prefix match.
 */
export function isActivePath(pathname: string, url: string): boolean {
  if (!url || url === PLACEHOLDER) return false
  if (pathname === url) return true
  return pathname.startsWith(url.endsWith("/") ? url : `${url}/`)
}

/** The section that should start open: the one containing the current page. */
export function sectionForPath(
  sections: readonly NavSection[],
  pathname: string
): string | null {
  const match = sections.find(
    (section) =>
      section.items?.some((item) => isActivePath(pathname, item.url)) ?? false
  )
  return match?.title ?? null
}
