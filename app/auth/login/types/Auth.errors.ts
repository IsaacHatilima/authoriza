/**
 * Thrown for every failed login, whether the email is unknown or the password
 * is wrong. One error type for both keeps the API response identical, so it
 * cannot be used to discover which addresses are registered.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password")
    this.name = "InvalidCredentialsError"
  }
}
