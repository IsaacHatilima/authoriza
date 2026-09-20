import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { profiles, users } from "@/db/schema"

import { AuthCredentials } from "../../types/Auth.types"

export class LoginRepository {
  /**
   * Looks up the credentials for an email address.
   *
   * The column list is explicit on purpose: `db.select()` with no projection
   * would return every column, and the first careless spread would ship the
   * password hash to the browser.
   */
  async findCredentialsByEmail(email: string): Promise<AuthCredentials | null> {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      // Left, not inner: a user without a profile must still be able to sign in.
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.email, email))
      .limit(1)

    return row ?? null
  }
}
