import { count } from "drizzle-orm"

import { db } from "@/db/client"
import { profiles, users } from "@/db/schema"
import { hashPassword } from "@/lib/password"
import { DEFAULT_USER_ROLE, isUserRole, UserRole } from "@/lib/roles"

export interface FirstUserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BootstrapError"
  }
}

const MIN_PASSWORD_LENGTH = 12
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validates the raw flags and environment into an input.
 *
 * The password minimum is deliberately stricter than the login form's: this
 * account is the one that provisions every other, and it is created once by
 * hand rather than chosen under pressure.
 */
export function parseFirstUserInput(
  raw: Record<string, string | undefined>
): FirstUserInput {
  const email = (raw.email ?? "").trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    throw new BootstrapError(
      `"${raw.email ?? ""}" is not a valid email address`
    )
  }

  const password = raw.password ?? ""
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BootstrapError(
      `The password must be at least ${MIN_PASSWORD_LENGTH} characters`
    )
  }

  const role = raw.role ?? DEFAULT_USER_ROLE
  if (!isUserRole(role)) {
    throw new BootstrapError(`"${role}" is not a role. Use admin or hr.`)
  }

  const firstName = (raw.firstName ?? "").trim()
  const lastName = (raw.lastName ?? "").trim()
  if (firstName === "" || lastName === "") {
    throw new BootstrapError("A first name and a last name are both required")
  }

  return { email, password, firstName, lastName, role }
}

/** Turns `--email a@b.c --role admin` into a plain record. */
export function parseArgs(argv: readonly string[]): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const [flag, inline] = arg.slice(2).split("=")
    const key = flag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    parsed[key] = inline ?? argv[++i] ?? ""
  }
  return parsed
}

/**
 * Creates the very first account, with its profile, in one transaction.
 *
 * Refuses once any user exists. This bootstraps an empty deployment; everyone
 * after the first is provisioned by an admin, not by re-running a script that
 * takes a plaintext password.
 */
export async function createFirstUser(
  input: FirstUserInput
): Promise<{ id: string; email: string; role: UserRole }> {
  const [{ value: existing }] = await db.select({ value: count() }).from(users)

  if (existing > 0) {
    throw new BootstrapError(
      `Refusing to run: ${existing} user(s) already exist. This script only bootstraps an empty database.`
    )
  }

  const passwordHash = await hashPassword(input.password)

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: input.email, passwordHash, role: input.role })
      .returning({ id: users.id, email: users.email, role: users.role })

    await tx.insert(profiles).values({
      userId: user.id,
      firstName: input.firstName,
      lastName: input.lastName,
    })

    return user
  })
}
