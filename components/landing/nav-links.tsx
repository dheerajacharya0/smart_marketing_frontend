"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const LINKS = [
  { id: "try", label: "Try it" },
  { id: "product", label: "Product" },
  { id: "use-cases", label: "Use cases" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
]

/** Sits just below the sticky header — a section counts as "current" once its
 * top has scrolled past this line. */
const HEADER_OFFSET = 120

/**
 * Highlights whichever section the visitor has scrolled to. The nav used to
 * hardcode "Try it" as permanently active — it never reflected position at
 * all. An earlier version tried IntersectionObserver with a narrow detection
 * band, but a fast scroll (flick, End key, or a big jump) can pass a whole
 * section through that band between rendered frames and never register —
 * confirmed live: scrolling straight to the bottom left "Use cases" stuck as
 * active with Pricing and FAQ both already scrolled past. Plain geometry on
 * every scroll event has no band to skip over.
 */
export function NavLinks() {
  const [active, setActive] = useState("try")

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    let frame = 0
    function update() {
      let current = sections[0].id
      for (const el of sections) {
        if (el.getBoundingClientRect().top <= HEADER_OFFSET) current = el.id
      }
      setActive(current)
    }
    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <nav className="hidden items-center gap-6 text-sm text-lp-muted md:flex lg:gap-8">
      {LINKS.map((l) => (
        <a
          key={l.id}
          href={`#${l.id}`}
          aria-current={active === l.id ? "true" : undefined}
          className={cn("py-3 transition hover:text-lp-fg", active === l.id ? "font-semibold text-lp-accent" : "")}
        >
          {l.label}
        </a>
      ))}
    </nav>
  )
}
