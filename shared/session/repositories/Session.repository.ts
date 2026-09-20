import { and, eq, gt, isNull, or, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { profiles, sessions, users } from "@/db/schema"

import type {
  NewSession,
  RememberCredentials,
  SessionWithUser,
} from "@/shared/session"

/**
 * Every database statement the session flow makes. Nothing here decides
 * policy: it takes digests and dates that the service has already worked out.
 */
export class SessionRepository {
  /**
   * A live session and its user, or null.
   *
   * Liveness is part of the WHERE clause rather than a check in JavaScript,
   * so a caller that forgets cannot resurrect an expired or revoked session.
   */
  async findActiveByTokenHash(
    tokenHash: string
  ): Promise<SessionWithUser | null> {
    const [row] = await db
      .select({
        id: sessions.id,
        userId: users.id,
        email: users.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      // Left, not inner: a user without a profile must still be able to sign in.
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          // A null expiry is a session that never expires, so it passes.
          or(isNull(sessions.expiresAt), gt(sessions.expiresAt, sql`now()`)),
          isNull(sessions.revokedAt)
        )
      )
      .limit(1)

    return row ?? null
  }

  async touch(sessionId: string): Promise<void> {
    await db
      .update(sessions)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(sessions.id, sessionId))
  }

  async create(session: NewSession): Promise<void> {
    await db.insert(sessions).values({
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      ip: session.origin.ip,
      userAgent: session.origin.userAgent,
    })
  }

  /** Stamps rather than deletes, so a sign-out stays in the audit trail. */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await db
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
  }

  async setRememberToken(userId: string, token: string | null): Promise<void> {
    await db
      .update(users)
      .set({ rememberToken: token })
      .where(eq(users.id, userId))
  }

  async findRememberCredentials(
    userId: string
  ): Promise<RememberCredentials | null> {
    const [row] = await db
      .select({
        id: users.id,
        rememberToken: users.rememberToken,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return row ?? null
  }
}
