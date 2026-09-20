import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password"
import { fullName } from "@/lib/person"
import { buildRecaller } from "@/lib/remember"
import { sessionService } from "@/shared/session"

import { InvalidCredentialsError } from "../../types/Auth.errors"
import { LoginResult, SessionOrigin } from "../../types/Auth.types"
import { Login } from "../../schemas/Login.schema"
import { LoginRepository } from "../repositories/Login.repository"

const repository = new LoginRepository()

export class LoginService {
  async handle(data: Login, origin: SessionOrigin): Promise<LoginResult> {
    const credentials = await repository.findCredentialsByEmail(data.email)

    // Verify against a real hash even when no account matched, so that both
    // paths cost the same. Returning early here would let an attacker map out
    // registered addresses by response time alone.
    const passwordMatches = await verifyPassword(
      credentials?.passwordHash ?? DUMMY_PASSWORD_HASH,
      data.password
    )

    if (!credentials || !passwordMatches) {
      throw new InvalidCredentialsError()
    }

    const session = await sessionService.issue(credentials.id, origin)

    // Laravel cycles the remember token on every remembered login and packs
    // the recaller from the token plus an HMAC of the password hash.
    const recaller = data.remember
      ? buildRecaller(
          credentials.id,
          await sessionService.cycleRememberToken(credentials.id),
          credentials.passwordHash
        )
      : null

    return {
      user: {
        id: credentials.id,
        email: credentials.email,
        name: fullName(credentials.firstName, credentials.lastName),
        role: credentials.role,
        emailVerified: credentials.emailVerifiedAt !== null,
      },
      session,
      recaller,
    }
  }
}
