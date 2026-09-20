// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useLogout } from "../Logout.hook"

afterEach(() => {
  vi.unstubAllGlobals()
})

const mockFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("useLogout", () => {
  it("posts to the logout endpoint", async () => {
    const fetchMock = mockFetch()
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout()
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    })
  })

  it("calls onSuccess afterwards", async () => {
    mockFetch()
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useLogout({ onSuccess }))

    await act(async () => {
      await result.current.logout()
    })

    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it("clears loading even when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.logout().catch(() => undefined)
    })

    expect(result.current.loading).toBe(false)
  })
})
