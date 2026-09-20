// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useLogin } from "../Login.hook"

const CREDENTIALS = { email: "ada@example.com", password: "a-password" }
const USER = { id: "u1", email: "ada@example.com", emailVerified: false }

const mockFetch = (body: unknown, init: { ok: boolean; status?: number }) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 401),
    json: async () => body,
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useLogin", () => {
  it("posts the credentials as JSON to the login endpoint", async () => {
    const fetchMock = mockFetch({ user: USER }, { ok: true })
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CREDENTIALS),
    })
  })

  it("returns the user on success", async () => {
    mockFetch({ user: USER }, { ok: true })
    const { result } = renderHook(() => useLogin())

    let returned
    await act(async () => {
      returned = await result.current.login(CREDENTIALS)
    })

    expect(returned).toEqual(USER)
    expect(result.current.error).toBeNull()
  })

  it("calls onSuccess with the user", async () => {
    mockFetch({ user: USER }, { ok: true })
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useLogin({ onSuccess }))

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(onSuccess).toHaveBeenCalledWith(USER)
  })

  it("surfaces the server's message when the login fails", async () => {
    mockFetch({ error: "Invalid email or password" }, { ok: false })
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(result.current.error).toBe("Invalid email or password")
  })

  it("returns null and does not call onSuccess when the login fails", async () => {
    mockFetch({ error: "Invalid email or password" }, { ok: false })
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useLogin({ onSuccess }))

    let returned
    await act(async () => {
      returned = await result.current.login(CREDENTIALS)
    })

    expect(returned).toBeNull()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("falls back to a generic message when the body carries no error", async () => {
    mockFetch({}, { ok: false, status: 500 })
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(result.current.error).toBe("Unable to sign in. Please try again.")
  })

  it("does not crash when the response body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token")
        },
      })
    )
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(result.current.error).toBe("Unable to sign in. Please try again.")
  })

  it("treats a 200 with no user as a failure", async () => {
    mockFetch({}, { ok: true })
    const { result } = renderHook(() => useLogin())

    let returned
    await act(async () => {
      returned = await result.current.login(CREDENTIALS)
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBe("Unable to sign in. Please try again.")
  })

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")))
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(result.current.error).toBe("Network down")
  })

  it("clears loading once the call settles", async () => {
    mockFetch({ user: USER }, { ok: true })
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it("clears a previous error on a new attempt", async () => {
    mockFetch({ error: "Invalid email or password" }, { ok: false })
    const { result } = renderHook(() => useLogin())
    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    mockFetch({ user: USER }, { ok: true })
    await act(async () => {
      await result.current.login(CREDENTIALS)
    })

    expect(result.current.error).toBeNull()
  })
})
