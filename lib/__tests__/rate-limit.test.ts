import { beforeEach, describe, expect, it } from "vitest"

import { consumeAttempt, resetRateLimits } from "@/lib/rate-limit"

const LIMIT = 3
const WINDOW_MS = 1000

beforeEach(() => {
  resetRateLimits()
})

describe("consumeAttempt", () => {
  it("allows attempts up to the limit", () => {
    const results = Array.from({ length: LIMIT }, () =>
      consumeAttempt("ip:1.2.3.4", {
        limit: LIMIT,
        windowMs: WINDOW_MS,
        now: 0,
      })
    )

    expect(results.every((result) => result.allowed)).toBe(true)
  })

  it("blocks the attempt after the limit", () => {
    for (let i = 0; i < LIMIT; i += 1) {
      consumeAttempt("ip:1.2.3.4", {
        limit: LIMIT,
        windowMs: WINDOW_MS,
        now: 0,
      })
    }

    const blocked = consumeAttempt("ip:1.2.3.4", {
      limit: LIMIT,
      windowMs: WINDOW_MS,
      now: 0,
    })

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(1)
  })

  it("counts each key separately", () => {
    for (let i = 0; i < LIMIT; i += 1) {
      consumeAttempt("ip:1.2.3.4", {
        limit: LIMIT,
        windowMs: WINDOW_MS,
        now: 0,
      })
    }

    const other = consumeAttempt("ip:5.6.7.8", {
      limit: LIMIT,
      windowMs: WINDOW_MS,
      now: 0,
    })

    expect(other.allowed).toBe(true)
  })

  it("starts a fresh window once the old one expires", () => {
    for (let i = 0; i < LIMIT; i += 1) {
      consumeAttempt("ip:1.2.3.4", {
        limit: LIMIT,
        windowMs: WINDOW_MS,
        now: 0,
      })
    }

    const afterWindow = consumeAttempt("ip:1.2.3.4", {
      limit: LIMIT,
      windowMs: WINDOW_MS,
      now: WINDOW_MS + 1,
    })

    expect(afterWindow.allowed).toBe(true)
  })

  it("reports how long the caller must wait", () => {
    for (let i = 0; i < LIMIT; i += 1) {
      consumeAttempt("ip:1.2.3.4", { limit: LIMIT, windowMs: 60_000, now: 0 })
    }

    const blocked = consumeAttempt("ip:1.2.3.4", {
      limit: LIMIT,
      windowMs: 60_000,
      now: 15_000,
    })

    expect(blocked.retryAfterSeconds).toBe(45)
  })

  it("drops expired keys instead of growing without bound", () => {
    for (let i = 0; i < 50; i += 1) {
      consumeAttempt(`ip:${i}`, { limit: LIMIT, windowMs: WINDOW_MS, now: 0 })
    }

    const { trackedKeys } = consumeAttempt("ip:later", {
      limit: LIMIT,
      windowMs: WINDOW_MS,
      now: WINDOW_MS + 1,
    })

    expect(trackedKeys).toBe(1)
  })
})
