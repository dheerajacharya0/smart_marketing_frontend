"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Sets `data-shown` the first time the element scrolls into view. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, shown }
}

/** Fades its children up the first time they scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, shown } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} data-shown={shown} style={{ transitionDelay: `${delay}ms` }} className={cn("lp-reveal", className)}>
      {children}
    </div>
  )
}

/**
 * Heading whose words blur-rise in one after another. `accent` words get the
 * animated gradient.
 */
export function SplitHeading({
  text,
  accent,
  className,
  as: Tag = "h2",
}: {
  text: string
  accent?: string
  className?: string
  as?: "h1" | "h2"
}) {
  const { ref, shown } = useInView<HTMLHeadingElement>()
  const words = [
    ...text.split(" ").map((w) => ({ w, accent: false })),
    ...(accent ? accent.split(" ").map((w) => ({ w, accent: true })) : []),
  ]
  return (
    <Tag ref={ref} data-shown={shown} className={className} aria-label={accent ? `${text} ${accent}` : text}>
      {words.map(({ w, accent: a }, i) => (
        <span key={i} aria-hidden="true">
          <span className={cn("lp-word", a && "lp-gradient-text")} style={{ transitionDelay: `${i * 55}ms` }}>
            {w}
          </span>{" "}
        </span>
      ))}
    </Tag>
  )
}

/** Card with a soft light that follows the cursor. */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
      }}
      className={cn("lp-spotlight rounded-3xl border border-lp-line transition-colors hover:border-lp-line-strong", className)}
    >
      {children}
    </div>
  )
}

/** Pulls its child a little toward the cursor while hovered. */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      className={cn("inline-block transition-transform duration-300 ease-out", className)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || prefersReducedMotion()) return
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const x = (e.clientX - (r.left + r.width / 2)) * strength
        const y = (e.clientY - (r.top + r.height / 2)) * strength
        el.style.transform = `translate(${x}px, ${y}px)`
      }}
      onPointerLeave={() => {
        if (ref.current) ref.current.style.transform = ""
      }}
    >
      {children}
    </span>
  )
}

const GLYPHS = "!<>-_\\/[]{}=+*^?#₹%$@"

/**
 * Cycles through words, each arriving as a "decrypt": random glyphs that
 * resolve left to right.
 */
export function ScrambleWords({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const [display, setDisplay] = useState(words[0])
  const index = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    let frame = 0
    let raf = 0
    const timer = setInterval(() => {
      index.current = (index.current + 1) % words.length
      const target = Array.from(words[index.current])
      const total = 22
      frame = 0
      cancelAnimationFrame(raf)
      const tick = () => {
        frame++
        const revealed = Math.floor((frame / total) * target.length)
        setDisplay(
          target
            .map((ch, i) => (i < revealed || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(""),
        )
        if (frame < total) raf = requestAnimationFrame(tick)
        else setDisplay(words[index.current])
      }
      raf = requestAnimationFrame(tick)
    }, interval)
    return () => {
      clearInterval(timer)
      cancelAnimationFrame(raf)
    }
  }, [words, interval])

  return (
    <span className={className} aria-live="off">
      {display}
    </span>
  )
}

/**
 * Hero stage: feeds cursor position to CSS (`--cx/--cy` for the spotlight,
 * `--rx/--ry` for the phone's 3D tilt).
 */
export function TiltStage({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={className}
      style={style}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || prefersReducedMotion()) return
        const el = e.currentTarget
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        el.style.setProperty("--cx", `${px * 100}%`)
        el.style.setProperty("--cy", `${py * 100}%`)
        el.style.setProperty("--ry", `${(px - 0.5) * 16}deg`)
        el.style.setProperty("--rx", `${(0.5 - py) * 12}deg`)
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty("--ry", "0deg")
        e.currentTarget.style.setProperty("--rx", "0deg")
      }}
    >
      {children}
    </div>
  )
}
