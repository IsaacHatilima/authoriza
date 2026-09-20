import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/cookies"
import { sessionService } from "@/shared/session"

import { env } from "@/lib/env"
import { REMEMBER_COOKIE_NAME } from "@/lib/cookies"

const expired = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 0,
} as const

/**
 * Ends the current session and forgets the device.
 *
 * Laravel cycles the remember token on logout, which invalidates the recaller
 * on every device at once. We do the same by clearing it, because the token is
 * per user rather than per device. The session row itself is only revoked for
 * this device, so other devices keep their live sessions until those expire.
 *
 * Always answers 200. Signing out is not a place to tell a caller whether a
 * token was real, and the cookies should be cleared either way.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  try {
    const session = await sessionService.findByToken(token)
    if (session) await sessionService.clearRememberToken(session.user.id)
    await sessionService.revokeByToken(token)
  } catch (error) {
    // The cookies are cleared regardless, so this browser is signed out even
    // if the rows could not be stamped.
    console.error("Failed to revoke the session on logout", error)
  }

  const response = NextResponse.json({ ok: true }, { status: 200 })
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", ...expired })
  response.cookies.set({ name: REMEMBER_COOKIE_NAME, value: "", ...expired })
  return response
}
