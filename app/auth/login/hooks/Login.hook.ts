// Intentionally no "use client" directive. This module is only ever imported
// by a client component, which is the real boundary. Adding the directive here
// makes Next's TypeScript plugin treat useLogin as a component and reject its
// onSuccess callback as a non-serializable prop (TS71007).

import { useCallback, useState } from "react"

import { Login } from "../schemas/Login.schema"
import { Auth } from "../types/Auth.types"

const LOGIN_ENDPOINT = "/api/auth/login"
const GENERIC_FAILURE = "Unable to sign in. Please try again."

interface LoginResponseBody {
  user?: Auth
  error?: string
}

interface UseLoginOptions {
  onSuccess?: (result: Auth) => void
}

interface UseLoginResult {
  login: (data: Login) => Promise<Auth | null>
  loading: boolean
  error: string | null
}

/**
 * Calls the login endpoint and tracks its state for the form.
 *
 * The hook talks to the API directly. There is no client-side service or
 * repository in between: the service and repository live behind the endpoint,
 * on the server, where the database is.
 */
export function useLogin({ onSuccess }: UseLoginOptions = {}): UseLoginResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(
    async (data: Login): Promise<Auth | null> => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(LOGIN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The session cookie is httpOnly and set by the server; the browser
          // stores it automatically on a same-origin request.
          body: JSON.stringify(data),
        })

        const body: LoginResponseBody = await response
          .json()
          .catch(() => ({}) as LoginResponseBody)

        if (!response.ok || !body.user) {
          // The server's message is deliberately generic for failed
          // credentials, so it cannot be used to probe for accounts.
          throw new Error(body.error ?? GENERIC_FAILURE)
        }

        onSuccess?.(body.user)
        return body.user
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : GENERIC_FAILURE)
        return null
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  return { login, loading, error }
}
