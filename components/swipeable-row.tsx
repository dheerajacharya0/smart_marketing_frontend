"use client"

import { useRef, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SwipeAction {
  label: string
  icon: LucideIcon
  /** Token class for the revealed strip, e.g. "bg-primary text-primary-foreground". */
  tone: string
  onTrigger: () => void
}

/**
 * How far a drag has to travel before letting go fires the action: 40% of the
 * row, never under 110px. A fixed 80px was a fifth of a phone row, so a casual
 * flick assigned conversations nobody meant to take.
 */
const THRESHOLD_FRACTION = 0.4
const MIN_THRESHOLD = 110
/** How far a row with no action on that side gives before stopping. */
const RUBBER_BAND = 20
/** Movement under this is still a tap, so the row's own link keeps working. */
const SLOP = 8

/**
 * A list row with a swipe action on either side, for touch only: a mouse keeps
 * clicking as before, and there is no hidden gesture a desktop user could
 * trigger by accident.
 *
 * The gesture locks to an axis on the first few pixels, so a vertical scroll
 * through the list never turns into a swipe. A swipe that fires, or even
 * travels, swallows the click that ends it, so the row's link doesn't also
 * navigate.
 */
export function SwipeableRow({
  children,
  left,
  right,
  className,
}: {
  children: ReactNode
  /** Revealed by dragging to the right. */
  left?: SwipeAction
  /** Revealed by dragging to the left. */
  right?: SwipeAction
  className?: string
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<"x" | "y" | null>(null)
  const moved = useRef(false)
  const armed = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  const threshold = useRef(MIN_THRESHOLD)

  const reset = () => {
    start.current = null
    axis.current = null
    armed.current = false
    setDragging(false)
    setOffset(0)
  }

  const clamp = (dx: number) => {
    const sign = Math.sign(dx)
    const abs = Math.abs(dx)
    // No action this way: give a little, then stop. A row that doesn't move
    // at all reads as a broken gesture rather than "nothing to do here".
    if ((dx > 0 && !left) || (dx < 0 && !right)) return sign * Math.min(abs * 0.15, RUBBER_BAND)
    // Resistance past the threshold, so it feels anchored rather than loose.
    const t = threshold.current
    return sign * (abs <= t ? abs : t + (abs - t) * 0.25)
  }

  const active = offset > 0 ? left : offset < 0 ? right : undefined
  const pastThreshold = Math.abs(offset) >= threshold.current

  return (
    <div ref={container} className={cn("relative overflow-hidden rounded-lg", className)}>
      {active && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center px-5 text-sm font-medium transition-opacity",
            offset > 0 ? "justify-start" : "justify-end",
            active.tone,
            pastThreshold ? "opacity-100" : "opacity-70",
          )}
        >
          <span className="flex items-center gap-2">
            <active.icon className={cn("h-5 w-5 transition-transform", pastThreshold && "scale-110")} />
            {active.label}
          </span>
        </div>
      )}
      <div
        className={cn("relative bg-card", !dragging && "transition-transform duration-base ease-out-soft")}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
          const width = container.current?.offsetWidth ?? 0
          threshold.current = Math.max(MIN_THRESHOLD, width * THRESHOLD_FRACTION)
          axis.current = null
          moved.current = false
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || e.pointerId !== s.id) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (!axis.current) {
            if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
            axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
            if (axis.current === "x") {
              e.currentTarget.setPointerCapture(e.pointerId)
              setDragging(true)
            }
          }
          if (axis.current !== "x") return
          moved.current = true
          const next = clamp(dx)
          const hasAction = next > 0 ? Boolean(left) : next < 0 ? Boolean(right) : false
          const nowArmed = hasAction && Math.abs(next) >= threshold.current
          // One short tick when the action arms — the cue that letting go now
          // will do something. Android only; iOS ignores vibrate.
          if (nowArmed && !armed.current) navigator.vibrate?.(8)
          armed.current = nowArmed
          setOffset(next)
        }}
        onPointerUp={() => {
          if (armed.current && active) active.onTrigger()
          reset()
        }}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
