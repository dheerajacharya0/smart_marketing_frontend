"use client"

import { useEffect, useState } from "react"

const AWAY_TITLE = "💬 Your customers are on WhatsApp…"
const SECRET = "diwali"
const PIECES = ["🪔", "✨", "🪔", "🎆", "✨", "🪔"]

/**
 * Small surprises for the landing page:
 * - leave the tab and its title nudges you back; return and it's restored;
 * - type "diwali" anywhere outside a field and diyas rain down.
 */
export function Delights() {
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    let saved = document.title
    const onVisibility = () => {
      if (document.hidden) {
        saved = document.title
        document.title = AWAY_TITLE
      } else if (document.title === AWAY_TITLE) {
        document.title = saved
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      if (document.title === AWAY_TITLE) document.title = saved
    }
  }, [])

  useEffect(() => {
    let typed = ""
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, [contenteditable='true']") || e.key.length !== 1) return
      typed = (typed + e.key.toLowerCase()).slice(-SECRET.length)
      if (typed === SECRET) {
        typed = ""
        setBurst((b) => b + 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(0), 4200)
    return () => clearTimeout(t)
  }, [burst])

  if (!burst) return null
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    <div key={burst} aria-live="polite" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {!reduce &&
        Array.from({ length: 36 }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="lp-fall absolute -top-12 text-2xl sm:text-3xl"
            style={{
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 9) * 0.18}s`,
              animationDuration: `${2.6 + (i % 5) * 0.35}s`,
            }}
          >
            {PIECES[i % PIECES.length]}
          </span>
        ))}
      <div className="lp-pop absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/50 bg-lp-elev px-5 py-3 text-sm font-semibold text-lp-fg shadow-[var(--lp-shadow)]">
        🪔 Happy Diwali from Converszio — you found the secret!
      </div>
    </div>
  )
}
