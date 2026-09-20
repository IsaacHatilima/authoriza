"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

import { useLogout } from "../../hooks/Logout.hook"

export function LogoutButton() {
  const router = useRouter()
  const { logout, loading } = useLogout({
    onSuccess: () => {
      router.push("/auth/login")
      // The page was rendered for a signed-in user, so drop its cached copy.
      router.refresh()
    },
  })

  return (
    <Button variant="outline" onClick={() => void logout()} disabled={loading}>
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  )
}
