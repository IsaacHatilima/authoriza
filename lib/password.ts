import { hash, hashSync, verify } from "@node-rs/argon2"

/**
 * The package defaults are already argon2id with m=19456, t=2, p=1, which is
 * the OWASP recommendation, so no options are passed.
 */
export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext)
}

/**
 * Verifies a password against a stored hash.
 *
 * @node-rs/argon2 throws "Decoding failed" when the stored value is not a
 * valid PHC string. Swallowing that into `false` matters for security: an
 * escaping error would turn a failed login into a 500, and the difference
 * between 500 and 401 tells an attacker which accounts exist.
 */
export async function verifyPassword(
  storedHash: string,
  plaintext: string
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext)
  } catch {
    return false
  }
}

/**
 * Hashed once at module load and used when no account matches the submitted
 * email, so the unknown-user path does the same argon2 work as the known-user
 * path. Without it, response time alone reveals which emails are registered.
 * The plaintext is irrelevant and intentionally cannot be logged in as.
 */
export const DUMMY_PASSWORD_HASH: string = hashSync(
  "authoriza::unused-dummy-password"
)
