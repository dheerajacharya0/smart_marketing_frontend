"use client"

import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { Moon, Sun } from "lucide-react"

const KEY = "cz-landing-theme"

/**
 * Runs before first paint (inlined at the top of the page) so the stored or
 * system theme is in place before anything renders — no flash.
 */
export const landingThemeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.lpTheme=t}catch(e){document.documentElement.dataset.lpTheme="dark"}})()`

/** Light/dark switch; the new theme grows out of the click point as a circle. */
export function ThemeToggle() {
  // Marks hydration, so tests (and anything else) know a click will land.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  function toggle(e: React.MouseEvent) {
    const root = document.documentElement
    const next = root.dataset.lpTheme === "light" ? "dark" : "light"
    const apply = () => {
      root.dataset.lpTheme = next
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // Private mode: the switch still works for this visit.
      }
    }

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduce) {
      apply()
      return
    }
    const x = e.clientX
    const y = e.clientY
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const transition = document.startViewTransition(() => flushSync(apply))
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 750, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
        )
      })
      .catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-ready={ready}
      aria-label="Switch light or dark theme"
      className="group relative grid size-9 place-items-center overflow-hidden rounded-full border border-lp-line-strong bg-lp-card text-lp-fg transition hover:border-lp-accent-line"
    >
      <Sun className="lp-show-dark size-4 transition-transform duration-500 group-hover:rotate-90" />
      <Moon className="lp-show-light size-4 transition-transform duration-500 group-hover:-rotate-12" />
    </button>
  )
}
