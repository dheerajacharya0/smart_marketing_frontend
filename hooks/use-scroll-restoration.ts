"use client"

import { useEffect, type RefObject } from "react"
import { usePathname } from "next/navigation"

const KEY_PREFIX = "scroll:"

/**
 * Keeps each dashboard route's scroll position in the shared `<main>`
 * scroll container (app/dashboard/layout.tsx never remounts it between
 * sibling routes, so the browser's own scroll restoration — which only
 * tracks `window` — never sees this element move at all). Restores on
 * mount/path change if we've been here before in this tab, otherwise
 * starts at the top, same as a first visit.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>) {
  const pathname = usePathname()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let saved = 0
    try {
      saved = Number(sessionStorage.getItem(KEY_PREFIX + pathname)) || 0
    } catch {
      // Private mode / storage disabled — just start at the top.
    }
    if (saved === 0) {
      el.scrollTop = 0
      return
    }
    // This element persists across sibling routes, so on "Back" it still
    // carries whatever momentum/rubber-band state mobile WebKit had going
    // when you tapped away. Jumping scrollTop straight to a saved value
    // while that's still settling leaves the gesture recognizer stuck —
    // the page renders at the right spot but ignores further upward
    // swipes. Toggling `overflow` off and back on forces WebKit to drop
    // that stale scroll state before the jump.
    const prevOverflow = el.style.overflow
    el.style.overflow = "hidden"
    el.scrollTop = saved
    requestAnimationFrame(() => {
      el.style.overflow = prevOverflow
    })
  }, [pathname, ref])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      try {
        sessionStorage.setItem(KEY_PREFIX + pathname, String(el.scrollTop))
      } catch {
        // Ignore — losing the saved position just means it won't restore.
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [pathname, ref])
}
