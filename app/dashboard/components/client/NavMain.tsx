"use client"

import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronRightIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

import { isActivePath, type NavSection, sectionForPath } from "../../navigation"

interface NavMainProps {
  sections: readonly NavSection[]
}

/**
 * The collapsible sections behave as an accordion: opening one closes the
 * rest. Each Collapsible is therefore controlled from a single piece of state
 * here rather than holding its own, which is what lets them close each other.
 */
export function NavMain({ sections }: NavMainProps) {
  const pathname = usePathname()
  // Only the section containing the current page starts open. Nothing is
  // forced open otherwise, so on a page that belongs to no section, such as
  // the dashboard itself, the whole tree is collapsed.
  const [openSection, setOpenSection] = useState<string | null>(() =>
    sectionForPath(sections, pathname)
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {sections.map((section) =>
          !section.items?.length ? (
            <SidebarMenuItem key={section.title}>
              <SidebarMenuButton
                tooltip={section.title}
                isActive={isActivePath(pathname, section.url)}
                render={<a href={section.url} />}
              >
                {section.icon}
                <span>{section.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <Collapsible
              key={section.title}
              open={openSection === section.title}
              onOpenChange={(open) =>
                setOpenSection(open ? section.title : null)
              }
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    tooltip={section.title}
                    // A parent is active when the page sits under one of its
                    // children, so the branch reads as current while closed.
                    isActive={section.items.some((item) =>
                      isActivePath(pathname, item.url)
                    )}
                  />
                }
              >
                {section.icon}
                <span>{section.title}</span>
                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {section.items.map((item) => (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton
                        isActive={isActivePath(pathname, item.url)}
                        render={<a href={item.url} />}
                      >
                        <span>{item.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
