import { fullName } from "@/lib/person"
import { parseRecaller, recallerMatches } from "@/lib/remember"
import { createRememberToken } from "@/lib/remember"
import { sessionExpiresAt } from "@/lib/session-lifetime"
import { createSessionToken, hashSessionToken } from "@/lib/session-token"

import { SessionRepository } from "../repositories/Session.repository"
import type {
  ActiveSession,
  IssuedSession,
  RecalledSession,
  SessionOrigin,
} from "../types/Session.types"

const repository = new SessionRepository()

/**
 * Everything the app does with a session, with the SQL kept next door in the
 * repository. This is shared rather than part of a feature: login, logout and
 * recall all mint or end sessions, and none of them owns the concept.
 */
export class SessionService {
  /** Resolves a cookie to the user it belongs to, or null. */
  async findByToken(
    token: string | undefined | null
  ): Promise<ActiveSession | null> {
    if (!token) return null

    const row = await repository.findActiveByTokenHash(hashSessionToken(token))
    if (!row) return null

    // Best-effort audit trail; a failure must not sign the person out.
    await repository.touch(row.id)

    return {
      id: row.id,
      user: {
        id: row.userId,
        email: row.email,
        name: fullName(row.firstName, row.lastName),
        role: row.role,
        emailVerified: row.emailVerifiedAt !== null,
      },
    }
  }

  /**
   * Creates a session and returns the token for the cookie.
   *
   * Shared by login and recall so the two cannot drift. Sessions last
   * SESSION_TTL_MINUTES, or forever when that is null: as in Laravel, being
   * remembered does not lengthen the session, it provides a way to start a
   * new one once this expires.
   */
  async issue(userId: string, origin: SessionOrigin): Promise<IssuedSession> {
    const token = createSessionToken()
    const expiresAt = sessionExpiresAt()

    await repository.create({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      origin,
    })

    return { token, expiresAt }
  }

  /** Ends one session, leaving the person signed in on other devices. */
  async revokeByToken(token: string | undefined | null): Promise<void> {
    if (!token) return
    await repository.revokeByTokenHash(hashSessionToken(token))
  }

  /**
   * Replaces a user's remember token, invalidating every recaller they hold.
   * Laravel cycles on login and again on logout, which is why signing out on
   * one device signs out the rest.
   */
  async cycleRememberToken(userId: string): Promise<string> {
    const token = createRememberToken()
    await repository.setRememberToken(userId, token)
    return token
  }

  /** Drops the token entirely, so no recaller can revive the account. */
  async clearRememberToken(userId: string): Promise<void> {
    await repository.setRememberToken(userId, null)
  }

  /**
   * Turns a recaller cookie back into a fresh session, or null.
   *
   * Both the token and the HMAC of the current password hash must match, so
   * a cycled token or a changed password stops the cookie working.
   */
  async recall(
    cookieValue: string | undefined | null,
    origin: SessionOrigin
  ): Promise<RecalledSession | null> {
    const recaller = parseRecaller(cookieValue)
    if (!recaller) return null

    const stored = await repository.findRememberCredentials(recaller.userId)
    if (!stored || !recallerMatches(recaller, stored)) return null

    const session = await this.issue(stored.id, origin)
    return { ...session, userId: stored.id }
  }
}

/** One instance, as every call site wants the same behaviour. */
export const sessionService = new SessionService()
