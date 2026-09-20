// No "use client" directive: this module is only imported by a client
// component, which is the real boundary.

import { useCallback, useState } from "react"

const LOGOUT_ENDPOINT = "/api/auth/logout"

interface UseLogoutOptions {
  onSuccess?: () => void
}

interface UseLogoutResult {
  logout: () => Promise<void>
  loading: boolean
}

/**
 * Ends the session. The endpoint always answers 200 and always clears the
 * cookie, so there is no failure path worth showing the person: the worst
 * case is a stamped-but-not-cleared row, and they are signed out regardless.
 */
export function useLogout({
  onSuccess,
}: UseLogoutOptions = {}): UseLogoutResult {
  const [loading, setLoading] = useState(false)

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await fetch(LOGOUT_ENDPOINT, { method: "POST" })
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  return { logout, loading }
}
