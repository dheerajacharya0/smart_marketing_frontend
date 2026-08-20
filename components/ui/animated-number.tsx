"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  /** Rendered before the number (e.g. "₹"). */
  prefix?: string
  /** Rendered after the number (e.g. "%"). */
  suffix?: string
  /** Decimal places. Defaults to 0. */
  decimals?: number
  /** Roll-up duration in ms. Defaults to --duration-slow (300ms) x2. */
  duration?: number
  /** Flash green/red once when the value changes. Defaults to true. */
  flashOnChange?: boolean
  className?: string
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return reduced
}

/**
 * Metric value that counts up on first paint and on live update, with a single
 * green/red delta flash. Part of the Signal motion system — every number in the
 * product goes through this, so roll-up timing stays consistent.
 *
 * Honors `prefers-reduced-motion` by snapping straight to the value.
 */
export function AnimatedNumber({
  value,
  prefix,
  suffix,
  decimals = 0,
  duration = 600,
  flashOnChange = true,
  className,
}: AnimatedNumberProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [display, setDisplay] = useState(value)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const fromRef = useRef(value)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return

    if (flashOnChange && from !== 0) {
      setFlash(value > from ? "up" : "down")
      window.setTimeout(() => setFlash(null), 900)
    }

    if (reducedMotion) {
      fromRef.current = value
      setDisplay(value)
      return
    }

    const start = performance.now()
    const delta = value - from

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutCubic — matches --ease-out-soft closely enough for numbers
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + delta * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      fromRef.current = value
    }
  }, [value, duration, reducedMotion, flashOnChange])

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        flash === "up" && "signal-flash-up",
        flash === "down" && "signal-flash-down",
        className,
      )}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
