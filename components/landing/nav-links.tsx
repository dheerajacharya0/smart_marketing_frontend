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

/**
 * Highlights whichever section is actually in view. The nav used to hardcode
 * "Try it" as permanently active — it never reflected where the visitor
 * actually scrolled to.
 */
export function NavLinks() {
  const [active, setActive] = useState("try")

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    // Treats the middle third of the viewport as "current" — a section only
    // takes over once it's actually what the visitor is looking at, not the
    // instant its top pixel crosses the bottom of the sticky header.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    for (const el of sections) observer.observe(el)
    return () => observer.disconnect()
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
