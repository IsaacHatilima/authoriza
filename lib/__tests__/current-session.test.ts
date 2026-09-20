import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const cookieStore = { get: vi.fn() }
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT")
})

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }))
vi.mock("next/navigation", () => ({ redirect }))

const findByToken = vi.fn()
vi.mock("@/shared/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/session")>()),
  sessionService: { findByToken },
}))

const { getCurrentSession, LOGIN_PATH, requireRole, requireSession } =
  await import("@/lib/current-session")
const { REMEMBER_COOKIE_NAME, SESSION_COOKIE_NAME } =
  await import("@/lib/cookies")

const SESSION = {
  id: "s1",
  user: {
    id: "u1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    role: "hr",
    emailVerified: true,
  },
}

/** Signed in, with no recaller cookie present. */
const onlySessionCookie = (name: string) =>
  name === SESSION_COOKIE_NAME ? { value: "a-token" } : undefined

beforeEach(() => {
  cookieStore.get.mockImplementation(onlySessionCookie)
  findByToken.mockResolvedValue(SESSION)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("getCurrentSession", () => {
  it("looks the session up by the cookie value", async () => {
    await getCurrentSession()

    expect(cookieStore.get).toHaveBeenCalledWith(SESSION_COOKIE_NAME)
    expect(findByToken).toHaveBeenCalledWith("a-token")
  })

  it("returns null when there is no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined)
    findByToken.mockResolvedValue(null)

    await expect(getCurrentSession()).resolves.toBeNull()
  })
})

describe("requireSession", () => {
  it("returns the session when one exists", async () => {
    await expect(requireSession()).resolves.toEqual(SESSION)
    expect(redirect).not.toHaveBeenCalled()
  })

  it("redirects to the login page when nobody is signed in", async () => {
    findByToken.mockResolvedValue(null)

    await expect(requireSession()).rejects.toThrowError("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith(LOGIN_PATH)
  })
})

describe("requireSession with a recaller present", () => {
  it("redirects through the recall route, carrying where to return", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === REMEMBER_COOKIE_NAME ? { value: "a-recaller" } : undefined
    )
    findByToken.mockResolvedValue(null)

    await expect(requireSession("/dashboard")).rejects.toThrowError(
      "NEXT_REDIRECT"
    )
    expect(redirect).toHaveBeenCalledWith("/api/auth/recall?next=%2Fdashboard")
  })

  it("goes to login, not recall, when there is no recaller", async () => {
    cookieStore.get.mockReturnValue(undefined)
    findByToken.mockResolvedValue(null)

    await expect(requireSession("/dashboard")).rejects.toThrowError(
      "NEXT_REDIRECT"
    )
    expect(redirect).toHaveBeenCalledWith(LOGIN_PATH)
  })
})

describe("requireRole", () => {
  it("allows a user holding the role", async () => {
    await expect(requireRole("hr")).resolves.toEqual(SESSION)
  })

  it("allows a user holding any of several roles", async () => {
    await expect(requireRole("admin", "hr")).resolves.toEqual(SESSION)
  })

  it("refuses a signed-in user without the role, rather than looping", async () => {
    await expect(requireRole("admin")).rejects.toThrowError(/Forbidden/)
    expect(redirect).not.toHaveBeenCalled()
  })

  it("still redirects when nobody is signed in", async () => {
    findByToken.mockResolvedValue(null)

    await expect(requireRole("admin")).rejects.toThrowError("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith(LOGIN_PATH)
  })
})
