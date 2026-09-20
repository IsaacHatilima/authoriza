import { NextResponse, type NextRequest } from "next/server"

import {
  REMEMBER_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  sessionCookieLifetime,
} from "@/lib/cookies"
import { env } from "@/lib/env"
import { sessionService } from "@/shared/session"

/** Where to send someone whose recaller turns out to be no good. */
const LOGIN_PATH = "/auth/login"

/** Any origin will do: it exists only so the parser has something to resolve against. */
const PROBE_ORIGIN = "http://probe.invalid"

/**
 * Only a path within this app, never an absolute URL. Without this the `next`
 * parameter is an open redirect: a crafted link would bounce a signed-in user
 * to another origin, from the real product domain and while signed in, which
 * is exactly what makes such a link useful for phishing.
 *
 * Checking the string by hand is not enough. The WHATWG parser that
 * `new URL()` uses treats a backslash as a slash for http(s), so `/\evil.com`
 * reads as protocol-relative and resolves to `https://evil.com/` while
 * sailing past a `startsWith("//")` test. The parser therefore decides, and
 * the normalised path is re-checked afterwards because `/..//evil.com`
 * normalises back to `//evil.com`.
 */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/"

  let parsed: URL
  try {
    parsed = new URL(value, PROBE_ORIGIN)
  } catch {
    return "/"
  }

  if (parsed.origin !== PROBE_ORIGIN) return "/"

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
  if (!path.startsWith("/") || path.startsWith("//")) return "/"
  return path
}

/** Clears the recaller and sends the person to the login page. */
function rejectRecaller(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl))
  response.cookies.set({
    name: REMEMBER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}

/**
 * Exchanges a recaller cookie for a fresh session, then continues.
 *
 * This exists because a Server Component cannot set cookies. The page guard
 * redirects here when the session has expired but a recaller is present, which
 * is the same job Laravel does inside its guard mid-request.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"))
  const cookie = request.cookies.get(REMEMBER_COOKIE_NAME)?.value

  let recalled
  try {
    recalled = await sessionService.recall(cookie, {
      ip:
        request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
        null,
      userAgent: request.headers.get("user-agent"),
    })
  } catch (error) {
    // A 500 here is worse than it looks: the guard sends people to this route
    // whenever a recaller is present, and a response that does not clear the
    // cookie leaves the browser bouncing back here on every page.
    console.error("Recall failed unexpectedly", error)
    return rejectRecaller(request)
  }

  // Stale or forged. Clear it so the browser stops presenting it.
  if (!recalled) return rejectRecaller(request)

  const response = NextResponse.redirect(new URL(next, request.nextUrl))
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: recalled.token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...sessionCookieLifetime(recalled.expiresAt),
  })
  return response
}
