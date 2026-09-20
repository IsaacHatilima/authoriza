import "@/lib/load-env"

import { assertTestDatabase } from "./vitest.shared"

assertTestDatabase(process.env.DATABASE_URL)

/**
 * jsdom implements no media queries, so anything reading the viewport throws.
 * Default to desktop, matching the server snapshot in hooks/use-mobile.
 * Guarded because most suites here run in the node environment.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

/**
 * jsdom implements neither pointer capture nor scrollIntoView nor
 * ResizeObserver, all of which the base-ui popups rely on. Without them a
 * dropdown silently refuses to open under test while working in a browser.
 */
if (typeof window !== "undefined") {
  const element = window.Element.prototype as unknown as Record<string, unknown>
  element.hasPointerCapture ??= () => false
  element.setPointerCapture ??= () => undefined
  element.releasePointerCapture ??= () => undefined
  element.scrollIntoView ??= () => undefined

  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
