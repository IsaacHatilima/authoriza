import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireSession } from "@/lib/current-session"

import { AppSidebar } from "./components/client/AppSidebar"
import { AccountSummary } from "./components/server/AccountSummary"
import { DashboardHeader } from "./components/server/DashboardHeader"

// The session is read per request, so this page can never be prerendered.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { user } = await requireSession("/dashboard")

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <DashboardHeader title="Overview" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <AccountSummary user={user} />
          <div className="min-h-[60vh] flex-1 rounded-xl bg-muted/50" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
