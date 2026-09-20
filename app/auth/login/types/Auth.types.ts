import { UserRole } from "@/lib/roles"

/**
 * What a successful login returns to the browser. Deliberately narrow: the
 * password hash and the session token must never appear here. The token
 * travels in an httpOnly cookie so client JavaScript cannot read it.
 */
export interface Auth {
  id: string
  email: string
  /** From the profile, which a user may not have yet. */
  name: string | null
  role: UserRole
  emailVerified: boolean
}

/** A row the login flow needs internally. Never serialised to a response. */
export interface AuthCredentials {
  id: string
  email: string
  passwordHash: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  emailVerifiedAt: Date | null
}

/** Where the session came from, recorded for audit and revocation. */
export interface SessionOrigin {
  ip: string | null
  userAgent: string | null
}

export interface IssuedSession {
  token: string
  /** Null when SESSION_TTL_MINUTES is null, meaning the session never expires. */
  expiresAt: Date | null
}

export interface LoginResult {
  user: Auth
  session: IssuedSession
  /** The recaller cookie value when the person asked to be remembered. */
  recaller: string | null
}
