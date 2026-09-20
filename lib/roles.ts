/**
 * Who a user is allowed to be. There is no self-registration: an admin
 * provisions accounts, so a role is always assigned rather than chosen.
 */
export const USER_ROLES = ["admin", "hr"] as const

export type UserRole = (typeof USER_ROLES)[number]

/** New accounts get the least privilege unless someone says otherwise. */
export const DEFAULT_USER_ROLE: UserRole = "hr"

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value)
}
