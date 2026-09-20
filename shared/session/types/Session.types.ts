import type { UserRole } from "@/lib/roles"

/** Who is signed in. Narrow on purpose: no password hash, no token. */
export interface SessionUser {
  id: string
  email: string
  /** From the profile, which a user may not have yet. */
  name: string | null
  role: UserRole
  emailVerified: boolean
}

export interface ActiveSession {
  id: string
  user: SessionUser
}

/** Where a session came from, recorded for audit and revocation. */
export interface SessionOrigin {
  ip: string | null
  userAgent: string | null
}

export interface IssuedSession {
  token: string
  /** Null when SESSION_TTL_MINUTES is null, meaning the session never expires. */
  expiresAt: Date | null
}

export interface RecalledSession extends IssuedSession {
  userId: string
}

/** A live session row joined to its user, as the repository returns it. */
export interface SessionWithUser {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  emailVerifiedAt: Date | null
}

/** What a recaller cookie is checked against. */
export interface RememberCredentials {
  id: string
  rememberToken: string | null
  passwordHash: string
}

export interface NewSession {
  userId: string
  tokenHash: string
  /** Null stores a session with no expiry. */
  expiresAt: Date | null
  origin: SessionOrigin
}
