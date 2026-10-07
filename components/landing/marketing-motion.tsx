"use client"

import { useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { useInView } from "@/components/landing/effects"

/*
 * Landing motion that shows the product at work — a campaign going out,
 * customers receiving it, follow-ups moving, results adding up — rather than
 * generic decoration. Every loop is transform/opacity only (see landing.css)
 * and stops under prefers-reduced-motion.
 */

const grouped = new Intl.NumberFormat("en-IN")

/** Example funnel: clearly labelled as an example, not a customer result. */
const FUNNEL = [
  { label: "Sent", value: 2400 },
  { label: "Delivered", value: 2352 },
  { label: "Read", value: 1896 },
  { label: "Replied", value: 408 },
]

/**
 * Campaign card whose funnel counts up row by row the first time it scrolls
 * into view: Sent → Delivered → Read → Replied.
 */
export function CampaignFunnel({ className }: { className?: string }) {
  const { ref, shown } = useInView<HTMLDivElement>()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!shown) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1)
      return
    }
    const start = performance.now()
    const duration = 2600
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setProgress(t)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [shown])

  const total = FUNNEL[0].value
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "lp-chip w-56 rounded-2xl border border-lp-line bg-lp-elev p-4 text-xs shadow-[0_18px_40px_-16px_rgba(13,15,20,0.35)]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 text-white">
          <Megaphone className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-lp-fg">Diwali offer</p>
          <p className="text-[0.65rem] text-lp-subtle">Example campaign</p>
        </div>
        <span className="relative ml-auto flex size-2">
          <span className="lp-pulse-ring absolute inset-0 rounded-full bg-teal-500" />
          <span className="relative size-2 rounded-full bg-teal-500" />
        </span>
      </div>
      <div className="mt-3.5 space-y-2.5">
        {FUNNEL.map((row, i) => {
          // Each row starts a beat after the one above it.
          const p = Math.max(0, Math.min(1, (progress - i * 0.18) / 0.46))
          const eased = 1 - Math.pow(1 - p, 3)
          const share = row.value / total
          return (
            <div key={row.label}>
              <div className="flex justify-between text-lp-muted">
                <span>{row.label}</span>
                <span className="font-lcd font-bold tabular-nums text-lp-fg">{grouped.format(Math.round(row.value * eased))}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-lp-line">
                <span
                  className={cn(
                    "block h-full origin-left rounded-full",
                    i === FUNNEL.length - 1 ? "bg-gradient-to-r from-teal-500 to-teal-400" : "bg-gradient-to-r from-blue-600 to-blue-400",
                  )}
                  style={{ transform: `scaleX(${share * eased})` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Customers around the hero phone: [initials, colour, position classes, delay s]. */
const AUDIENCE: [string, string, string, number][] = [
  ["PS", "bg-rose-500", "-left-16 top-24", 0.5],
  ["AK", "bg-amber-500", "-left-20 top-[44%]", 1.4],
  ["RM", "bg-violet-500", "-top-6 right-20", 2.3],
  ["NJ", "bg-sky-500", "-right-14 top-16", 0.9],
  ["VT", "bg-emerald-500", "-right-20 top-[48%]", 1.8],
  ["SG", "bg-orange-500", "-right-8 bottom-10", 2.7],
]

/**
 * One send, many customers: waves pulse out from the phone and each customer
 * around it ticks ✓✓ as a wave reaches them. Sits behind the phone.
 */
export function Broadcast() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 -z-10 size-[520px] -translate-x-1/2 -translate-y-1/2">
        {[0, 1.2, 2.4].map((delay) => (
          <span
            key={delay}
            className="lp-ring absolute inset-0 rounded-full border-2 border-blue-500/35"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      {AUDIENCE.map(([initials, colour, pos, delay]) => (
        <span key={initials} className={cn("absolute z-10", pos)}>
          <span
            className={cn(
              "lp-receive grid size-10 place-items-center rounded-full text-[0.7rem] font-bold text-white ring-4 ring-[color:var(--lp-bg)]",
              colour,
            )}
            style={{ animationDelay: `${delay}s` }}
          >
            {initials}
          </span>
          <span
            className="lp-receive-badge absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-white text-[0.6rem] font-bold text-sky-500 shadow"
            style={{ animationDelay: `${delay}s` }}
          >
            ✓✓
          </span>
        </span>
      ))}
    </div>
  )
}

const SEGMENT = new Set([1, 3, 4, 8, 9, 11, 14, 16])

/** Small looping visual at the top of each pillar card. */
export function PillarVisual({ kind }: { kind: "reach" | "follow" | "clarity" }) {
  return (
    <div aria-hidden="true" className="relative h-28 overflow-hidden rounded-2xl border border-lp-line bg-lp-elev">
      {kind === "reach" && (
        <div className="flex h-full items-center justify-between gap-4 px-5">
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="relative size-3.5 rounded-full bg-lp-line-strong">
                {SEGMENT.has(i) && (
                  <span className="lp-target absolute inset-0 rounded-full bg-blue-600" style={{ animationDelay: `${i * 0.07}s` }} />
                )}
              </span>
            ))}
          </div>
          <div className="lp-target-label shrink-0 rounded-xl border border-lp-accent-line bg-lp-accent-soft px-2.5 py-1.5 text-[0.7rem] leading-tight">
            <p className="font-semibold text-lp-fg">Repeat buyers</p>
            <p className="text-lp-muted">8 of 18 contacts</p>
          </div>
        </div>
      )}

      {kind === "follow" && (
        <div className="flex h-full flex-col justify-center px-6">
          <div className="relative mx-2">
            <div className="h-0.5 rounded-full bg-lp-line-strong" />
            <div className="lp-travel absolute inset-x-0 top-1/2">
              <span className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 shadow-[0_0_14px_rgba(37,99,235,0.7)]" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="lp-node absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-lp-elev"
                style={{ left: `${(i / 3) * 100}%`, animationDelay: `${i * 1.07}s` }}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-between text-[0.68rem] font-medium text-lp-muted">
            <span>Sent</span>
            <span>Wait 1 day</span>
            <span>Replied?</span>
            <span>Offer</span>
          </div>
        </div>
      )}

      {kind === "clarity" && (
        <div className="flex h-full items-end gap-2 px-5 pb-4 pt-6">
          {[38, 52, 46, 68, 60, 86].map((h, i) => (
            <span key={i} className="flex h-full flex-1 items-end">
              <span
                className={cn(
                  "lp-grow block w-full origin-bottom rounded-t-md",
                  i === 5 ? "bg-gradient-to-t from-teal-600 to-teal-400" : "bg-gradient-to-t from-blue-600 to-blue-400",
                )}
                style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }}
              />
            </span>
          ))}
          <span className="lp-target-label absolute right-3 top-2.5 rounded-full border border-lp-line bg-lp-elev px-2 py-0.5 text-[0.65rem] font-semibold text-lp-teal">
            ↑ Attributed sales
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Journey cue above the "How it works" cards: a message travels from step 1
 * to step 3, lighting each step as it passes. Columns match the card grid.
 */
export function JourneyLine() {
  return (
    <div aria-hidden="true" className="relative mt-12 hidden h-6 md:block">
      {/* From the first card's icon to the third's: 46px in, across two columns and gaps. */}
      <div className="absolute left-[46px] top-1/2 w-[calc((100%-2rem)*2/3+2rem)]">
        <div className="h-0.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/40 via-teal-500/40 to-blue-500/40" />
        <div className="lp-travel lp-travel-slow absolute inset-x-0 top-0">
          <span className="absolute -right-2.5 top-0 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-[0.6rem] text-white shadow-[0_0_16px_rgba(37,99,235,0.7)]">
            ✉
          </span>
        </div>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="lp-node lp-node-slow absolute top-0 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-lp-bg"
            style={{ left: `${i * 50}%`, animationDelay: `${i * 2.4}s` }}
          />
        ))}
      </div>
    </div>
  )
}
