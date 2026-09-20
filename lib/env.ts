import { z } from "zod"

const POSTGRES_PROTOCOL = /^postgres(ql)?$/

/**
 * The value shipped in .env.example. It is long enough to pass the length
 * check, so without this the one secret the app has could be left at a value
 * published in a public repository and nothing would complain at startup.
 * Keep it in step with .env.example.
 */
const PLACEHOLDER_APP_SECRET = "replace-me-with-32-or-more-random-characters"

/** An hour for an ordinary sign-in. */
const DEFAULT_SESSION_TTL_MINUTES = 60
/** Laravel's default recaller lifetime: 400 days. */
const DEFAULT_REMEMBER_TTL_MINUTES = 576_000
/** Laravel's own remember duration, 400 days, is the ceiling. */
const MAX_TTL_MINUTES = 576_000

/** Env values arrive as strings, so coerce and then insist on whole minutes. */
const minutes = (fallback: number, name: string) =>
  z.coerce
    .number({ error: `${name} must be a whole number of minutes` })
    .int(`${name} must be a whole number of minutes`)
    .positive(`${name} must be greater than zero`)
    .max(MAX_TTL_MINUTES, `${name} must be at most ${MAX_TTL_MINUTES} minutes`)
    .default(fallback)

/**
 * Written in .env to mean "no expiry", as Sanctum's `expiration => null`.
 *
 * An empty value is deliberately absent: `SESSION_TTL_MINUTES=` reads as a
 * half-deleted line, not as a decision to let sessions live forever.
 */
const NEVER = new Set(["null", "none", "never"])

/**
 * Minutes, or null for a session that never expires.
 *
 * Leaving the key out keeps the default. Writing `null` is the explicit
 * choice of no expiry, so a missing line and a deliberate one cannot be
 * confused for each other.
 */
const minutesOrNever = (fallback: number, name: string) =>
  z
    .unknown()
    .default(fallback)
    .transform((value, ctx): number | null => {
      if (value === null || NEVER.has(String(value).trim().toLowerCase())) {
        return null
      }

      const parsed = Number(value)
      const valid =
        Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_TTL_MINUTES
      if (!valid) {
        ctx.addIssue({
          code: "custom",
          message: `${name} must be a whole number of minutes from 1 to ${MAX_TTL_MINUTES}, or null for no expiry`,
        })
        return z.NEVER
      }
      return parsed
    })

const envSchema = z
  .object({
    DATABASE_URL: z.url({
      protocol: POSTGRES_PROTOCOL,
      error:
        "DATABASE_URL must be a postgres:// or postgresql:// connection string",
    }),
    // null means the session never expires, Sanctum's `expiration => null`.
    SESSION_TTL_MINUTES: minutesOrNever(
      DEFAULT_SESSION_TTL_MINUTES,
      "SESSION_TTL_MINUTES"
    ),
    SESSION_REMEMBER_TTL_MINUTES: minutes(
      DEFAULT_REMEMBER_TTL_MINUTES,
      "SESSION_REMEMBER_TTL_MINUTES"
    ),
    // Keys the HMAC of the password hash carried in the recaller cookie, so
    // changing a password invalidates every remembered device. Laravel uses
    // the app key for this.
    APP_SECRET: z
      .string()
      .min(32, "APP_SECRET must be at least 32 characters")
      .refine((value) => value !== PLACEHOLDER_APP_SECRET, {
        error:
          "APP_SECRET is still the placeholder from .env.example. That value " +
          "is published in this repository, so anyone could forge a " +
          "remember-me cookie. Generate one with: openssl rand -base64 32",
      }),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .refine(
    (value) =>
      // A session that never expires has nothing to be shorter than.
      value.SESSION_TTL_MINUTES === null ||
      value.SESSION_REMEMBER_TTL_MINUTES >= value.SESSION_TTL_MINUTES,
    {
      path: ["SESSION_REMEMBER_TTL_MINUTES"],
      error:
        "SESSION_REMEMBER_TTL_MINUTES must be at least SESSION_TTL_MINUTES, " +
        "otherwise remembering someone signs them out sooner",
    }
  )

export type Env = z.infer<typeof envSchema>

/**
 * Validates the environment variables the app depends on.
 * Throws a descriptive error so misconfiguration fails at startup, not at
 * the first query.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`
    )
  }
  return result.data
}

export const env = parseEnv(process.env)
