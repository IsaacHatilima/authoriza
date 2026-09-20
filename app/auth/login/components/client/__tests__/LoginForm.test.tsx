// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "../LoginForm"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole("button", { name: /login/i }))
}

const mockFetch = (body: unknown, ok: boolean) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 401,
    json: async () => body,
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  push.mockReset()
})

describe("LoginForm", () => {
  it("renders an email and a password field", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText(/email/i)).toBeDefined()
    expect(screen.getByLabelText(/password/i)).toBeDefined()
  })

  it("names the checkbox exactly once for assistive tech", () => {
    render(<LoginForm />)

    expect(
      screen.getAllByRole("checkbox", { name: /keep me signed in/i })
    ).toHaveLength(1)
  })

  it("masks the password input", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText(/password/i)).toHaveProperty(
      "type",
      "password"
    )
  })

  it("submits the credentials to the login endpoint", async () => {
    const fetchMock = mockFetch(
      { user: { id: "u1", email: "ada@example.com", emailVerified: false } },
      true
    )
    render(<LoginForm />)

    await fillAndSubmit("ada@example.com", "a-good-password")

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" })
      )
    )
  })

  it("redirects to the dashboard once the login succeeds", async () => {
    mockFetch(
      { user: { id: "u1", email: "ada@example.com", emailVerified: false } },
      true
    )
    render(<LoginForm />)

    await fillAndSubmit("ada@example.com", "a-good-password")

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
  })

  it("does not ask to be remembered by default", async () => {
    const fetchMock = mockFetch(
      { user: { id: "u1", email: "ada@example.com", emailVerified: false } },
      true
    )
    render(<LoginForm />)

    await fillAndSubmit("ada@example.com", "a-good-password")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.remember).toBe(false)
  })

  it("ticks the box when the label text is clicked", async () => {
    // Regression: the text was a plain div for a while, so clicking the words
    // did nothing. People click the words, then wonder why they were signed
    // out an hour later.
    const fetchMock = mockFetch(
      { user: { id: "u1", email: "ada@example.com", emailVerified: false } },
      true
    )
    render(<LoginForm />)
    const user = userEvent.setup()

    await user.click(screen.getByText(/keep me signed in/i))
    await fillAndSubmit("ada@example.com", "a-good-password")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).remember).toBe(true)
  })

  it("sends remember when the box is ticked", async () => {
    const fetchMock = mockFetch(
      { user: { id: "u1", email: "ada@example.com", emailVerified: false } },
      true
    )
    render(<LoginForm />)
    const user = userEvent.setup()

    await user.click(
      screen.getByRole("checkbox", { name: /keep me signed in/i })
    )
    await fillAndSubmit("ada@example.com", "a-good-password")

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.remember).toBe(true)
  })

  it("shows the server's message when the login fails", async () => {
    mockFetch({ error: "Invalid email or password" }, false)
    render(<LoginForm />)

    await fillAndSubmit("ada@example.com", "a-good-password")

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Invalid email or password"
    )
    expect(push).not.toHaveBeenCalled()
  })

  it("never navigates on failure", async () => {
    mockFetch({ error: "Invalid email or password" }, false)
    render(<LoginForm />)

    await fillAndSubmit("ada@example.com", "a-good-password")

    await screen.findByRole("alert")
    expect(push).not.toHaveBeenCalled()
  })
})
