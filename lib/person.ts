/**
 * A person's display name, or null when they have no profile yet.
 *
 * The profile is a separate row and a user can exist without one, so every
 * caller has to cope with its absence rather than rendering "null null".
 */
export function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string | null {
  const name = [firstName, lastName]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "")
    .join(" ")
  return name === "" ? null : name
}

/**
 * Two letters for an avatar. Uses the name where there is one, so it reads as
 * a person rather than as an address, and falls back to the email otherwise.
 */
export function initialsFor(
  name: string | null | undefined,
  email: string
): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []

  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}
