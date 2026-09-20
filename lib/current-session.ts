import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { REMEMBER_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/cookies"
import type { ActiveSession } from "@/shared/session"
import { sessionService } from "@/shared/session"

import { UserRole } from "@/lib/roles"

/** Where an unauthenticated visitor is sent. */
export const LOGIN_PATH = "/auth/login"

/** Exchanges a recaller cookie for a session, then redirects back. */
export const RECALL_PATH = "/api/auth/recall"

/** The session for the current request, or null when nobody is signed in. */
export async function getCurrentSession(): Promise<ActiveSession | null> {
  const store = await cookies()
  return sessionService.findByToken(store.get(SESSION_COOKIE_NAME)?.value)
}

/**
 * The session, or a redirect to the login page.
 *
 * Called inside the page or route that needs it, rather than once in a
 * proxy, so the check sits next to the data it protects and cannot be
 * bypassed by a route that forgot to opt in.
 */
export async function requireSession(
  currentPath: string = "/"
): Promise<ActiveSession> {
  const session = await getCurrentSession()
  if (session) return session

  // A Server Component cannot set a cookie, so recall runs in a route handler
  // and sends the person back here. Only bother when a recaller is actually
  // present, otherwise this would bounce every anonymous visitor.
  const store = await cookies()
  if (store.get(REMEMBER_COOKIE_NAME)?.value) {
    redirect(`${RECALL_PATH}?next=${encodeURIComponent(currentPath)}`)
  }

  redirect(LOGIN_PATH)
}

/**
 * The session, provided the user holds one of the given roles.
 *
 * An authenticated user without the role is refused rather than redirected to
 * the login page: they are signed in, so sending them to sign in again would
 * loop, and it would also leak that the page exists.
 */
export async function requireRole(
  ...allowed: readonly UserRole[]
): Promise<ActiveSession> {
  const session = await requireSession()
  if (!allowed.includes(session.user.role)) {
    throw new Error(
      `Forbidden: this page needs ${allowed.join(" or ")}, not ${session.user.role}`
    )
  }
  return session
}
