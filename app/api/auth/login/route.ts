import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { SESSION_COOKIE_NAME, sessionCookieLifetime } from "@/lib/cookies"

import { env } from "@/lib/env"
import { consumeAttempt } from "@/lib/rate-limit"
import { REMEMBER_COOKIE_NAME } from "@/lib/cookies"
import { rememberTtlMs } from "@/lib/session-lifetime"

import { LoginSchema } from "../../../auth/login/schemas/Login.schema"
import { LoginService } from "../../../auth/login/server/services/Login.service"
import { InvalidCredentialsError } from "../../../auth/login/types/Auth.errors"

const service = new LoginService()

/** Bodies larger than this are rejected before they are parsed. */
const MAX_BODY_BYTES = 4096
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
/** Coarse, and spoofable via x-forwarded-for, so it is the looser of the two. */
const MAX_ATTEMPTS_PER_IP = 20
/** Tight, and cannot be spoofed away, so this is the one that protects accounts. */
const MAX_ATTEMPTS_PER_EMAIL = 5

const GENERIC_FAILURE = "Invalid email or password"

function clientIp(request: NextRequest): string | null {
  // NextRequest.ip was removed in Next 15. This header is attacker-controlled,
  // which is why the per-email limit carries the real weight.
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",").at(-1)?.trim() ?? null
}

function tooManyAttempts(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many login attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 })
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.flattenError(parsed.error) },
      { status: 400 }
    )
  }

  const ip = clientIp(request)
  const limits = { windowMs: RATE_LIMIT_WINDOW_MS }
  const byIp = ip
    ? consumeAttempt(`login:ip:${ip}`, {
        ...limits,
        limit: MAX_ATTEMPTS_PER_IP,
      })
    : null
  if (byIp && !byIp.allowed) {
    return tooManyAttempts(byIp.retryAfterSeconds)
  }

  const byEmail = consumeAttempt(`login:email:${parsed.data.email}`, {
    ...limits,
    limit: MAX_ATTEMPTS_PER_EMAIL,
  })
  if (!byEmail.allowed) {
    return tooManyAttempts(byEmail.retryAfterSeconds)
  }

  try {
    const { user, session, recaller } = await service.handle(parsed.data, {
      ip,
      userAgent: request.headers.get("user-agent"),
    })

    const response = NextResponse.json({ user }, { status: 200 })
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      // Hard-coding `true` would break login over http://localhost.
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // One source of truth: the same instant stored in sessions.expires_at,
      // so the cookie and the row can never disagree. A session with no
      // expiry gets the longest life a browser will keep a cookie for.
      ...sessionCookieLifetime(session.expiresAt),
    })

    // The recaller outlives the session. When the session expires the browser
    // still sends this, and /api/auth/recall turns it into a new session.
    if (recaller !== null) {
      response.cookies.set({
        name: REMEMBER_COOKIE_NAME,
        value: recaller,
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(rememberTtlMs() / 1000),
      })
    }

    return response
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      // Identical body and status for an unknown email and a wrong password.
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 })
    }

    // Log the detail server-side; return nothing that describes the failure.
    console.error("Login failed unexpectedly", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
