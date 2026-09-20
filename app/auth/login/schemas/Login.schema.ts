import { z } from "zod"

/** RFC 5321 caps an address at 254 characters. */
const MAX_EMAIL_LENGTH = 254
const MIN_PASSWORD_LENGTH = 8
/** Not an argon2 limit, just a bound on what is parsed and logged. */
const MAX_PASSWORD_LENGTH = 1024

export const LoginSchema = z.object({
  // Trim and lowercase BEFORE validating: users.email is case-sensitive text,
  // so someone who registered with capitals could otherwise never sign in, and
  // a stray trailing space would fail validation instead of being cleaned up.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address").max(MAX_EMAIL_LENGTH)),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters")
    .max(MAX_PASSWORD_LENGTH),
  // Picks which of the two configured lifetimes the session gets. Optional so
  // a client can leave it out, which means the short one.
  remember: z.boolean().optional(),
})

export type Login = z.infer<typeof LoginSchema>
