import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Subscribes to the media query rather than mirroring it into state.
 *
 * The generated version set state inside an effect, which React's lint rule
 * rejects because it causes a second render on mount. useSyncExternalStore is
 * the intended shape for reading an external source like matchMedia, and its
 * server snapshot lets the first paint match the client's.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches

/** The server cannot know the viewport, so it assumes desktop. */
const getServerSnapshot = (): boolean => false

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
