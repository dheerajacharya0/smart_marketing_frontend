"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { ArrowRight, Delete } from "lucide-react"
import { cn } from "@/lib/utils"
import { compare, formatInr, META_RATES_INR, type MessageCategory } from "@/lib/savings"

const MAX_DIGITS = 8
const CATEGORIES: { key: MessageCategory; label: string }[] = [
  { key: "marketing", label: "Marketing" },
  { key: "utility", label: "Utility" },
  { key: "authentication", label: "OTP" },
]
const PRESETS = [
  { label: "1K", value: 1_000 },
  { label: "10K", value: 10_000 },
  { label: "50K", value: 50_000 },
  { label: "1L", value: 100_000 },
]

const grouped = new Intl.NumberFormat("en-IN")

/** Eases a displayed number toward its target. */
function useTween(target: number, duration = 650) {
  const [value, setValue] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      current.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const from = current.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const next = from + (target - from) * (1 - Math.pow(1 - t, 4))
      current.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

export function Calculator() {
  const [digits, setDigits] = useState("25000")
  const [category, setCategory] = useState<MessageCategory>("marketing")
  const [pressed, setPressed] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)

  const messages = Number(digits || "0")
  const result = useMemo(() => compare(messages, category), [messages, category])
  const savings = useTween(result.maxSavings)
  const ourTotal = useTween(result.ours.total)
  const max = Math.max(...result.theirs.map((q) => q.total), 1)

  const press = useCallback((key: string) => {
    setPressed(key)
    setTimeout(() => setPressed((p) => (p === key ? null : p)), 120)
    setDigits((d) => {
      if (key === "C") return ""
      if (key === "back") return d.slice(0, -1)
      if (key === "=") return d
      return ((d === "0" ? "" : d) + key).replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS)
    })
    if (key === "=") setFlash((f) => f + 1)
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (/^\d$/.test(e.key)) press(e.key)
    else if (e.key === "Backspace") press("back")
    else if (e.key === "Escape" || e.key.toLowerCase() === "c") press("C")
    else if (e.key === "Enter" || e.key === "=") press("=")
    else return
    e.preventDefault()
  }

  const keys: { k: string; label: ReactNode; className?: string; aria?: string }[] = [
    { k: "7", label: "7" },
    { k: "8", label: "8" },
    { k: "9", label: "9" },
    { k: "back", label: <Delete className="size-5" />, aria: "Delete last digit", className: "!text-rose-500" },
    { k: "4", label: "4" },
    { k: "5", label: "5" },
    { k: "6", label: "6" },
    { k: "C", label: "C", aria: "Clear", className: "!text-rose-500" },
    { k: "1", label: "1" },
    { k: "2", label: "2" },
    { k: "3", label: "3" },
    { k: "00", label: "00" },
    { k: "0", label: "0", className: "col-span-2" },
    { k: "000", label: "000" },
    { k: "=", label: "=", aria: "Compare", className: "lp-key-accent" },
  ]

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr] lg:gap-10">
      {/* The device */}
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Message calculator. Type a monthly message count."
        className="lp-calc lp-glow-border mx-auto w-full max-w-[400px] rounded-[2rem] p-5 shadow-[var(--lp-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 sm:p-6"
      >
        <div className="flex items-center justify-between">
          <span className="font-lcd text-[0.65rem] tracking-[0.3em] text-lp-subtle">CONVERSZIO · CZ-01</span>
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
            <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
            <span className="size-1.5 animate-pulse rounded-full bg-teal-300 shadow-[0_0_8px_#5eead4]" />
          </span>
        </div>

        <div role="radiogroup" aria-label="Message type" className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[var(--calc-seg)] p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              role="radio"
              aria-checked={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "rounded-lg py-2 text-xs font-semibold transition",
                category === c.key ? "bg-lp-elev text-lp-fg shadow" : "text-lp-muted hover:text-lp-fg",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="lp-lcd relative mt-4 overflow-hidden rounded-2xl px-4 pb-3 pt-3">
          <div aria-hidden="true" className="lp-scanlines pointer-events-none absolute inset-0" />
          <div className="font-lcd flex justify-between text-[0.62rem] tracking-[0.2em] text-teal-300/60">
            <span>MSGS / MONTH</span>
            <span>₹{META_RATES_INR[category]} EACH</span>
          </div>
          <p className="font-lcd lp-lcd-text mt-1 truncate text-right text-[2.6rem] font-bold leading-tight tabular-nums" aria-live="polite">
            {grouped.format(messages)}
            <span className="ml-0.5 inline-block w-[0.5ch] animate-pulse text-teal-200/70">_</span>
          </p>
          <div className="font-lcd flex justify-between border-t border-teal-300/15 pt-2 text-[0.7rem] text-teal-200/80">
            <span>META BILL</span>
            <span className="tabular-nums">{formatInr(ourTotal)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDigits(String(p.value))}
              className={cn(
                "rounded-lg border py-2.5 text-xs font-semibold transition",
                messages === p.value
                  ? "border-lp-accent-line bg-lp-accent-soft text-lp-accent"
                  : "border-lp-line text-lp-muted hover:border-lp-line-strong hover:text-lp-fg",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2.5">
          {keys.map(({ k, label, className, aria }) => (
            <button
              key={k}
              type="button"
              aria-label={aria}
              data-pressed={pressed === k}
              onClick={() => press(k)}
              className={cn("lp-key font-lcd grid h-14 place-items-center rounded-2xl text-xl font-semibold", className)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The comparison */}
      <div key={flash} className={cn(flash > 0 && "lp-rise")}>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-lp-muted">With Converszio you save up to</p>
        <p className="font-landing lp-gradient-text mt-2 text-[clamp(3rem,8vw,5.25rem)] font-bold leading-none tracking-[-0.04em] tabular-nums">
          {formatInr(savings)}
          <span className="text-[0.35em] font-semibold tracking-normal">/mo</span>
        </p>
        <p className="mt-3 text-lp-muted">
          That&apos;s <span className="font-semibold text-lp-fg">{formatInr(result.maxSavings * 12)}</span> a year — and{" "}
          <span className="font-semibold text-lp-fg">{formatInr(result.avgSavings)}/mo</span> less than the average plan.
        </p>

        <ul className="mt-8 space-y-3">
          <li className="lp-glow-border rounded-2xl bg-lp-accent-soft p-4">
            <Row
              name="Converszio"
              detail="₹0 plan · 0% markup"
              total={result.ours.total}
              highlight
              bar={
                <span
                  className="lp-bar block h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500 shadow-[0_0_16px_rgba(37,99,235,0.55)]"
                  style={{ width: `${Math.max(1.5, (result.ours.total / max) * 100)}%` }}
                />
              }
            />
          </li>
          {result.theirs.map((q, i) => (
            <li
              key={q.provider.id}
              className="lp-pop rounded-2xl border border-lp-line bg-lp-card p-4 transition hover:border-lp-line-strong"
              style={{ animationDelay: `${(i + 1) * 70}ms` }}
            >
              <Row
                name={q.provider.name}
                detail={`${formatInr(q.provider.plan)} ${q.provider.planLabel.toLowerCase()} + ${Math.round(q.provider.markup * 100)}% markup`}
                total={q.total}
                bar={
                  <span className="lp-bar flex h-full overflow-hidden rounded-full" style={{ width: `${(q.total / max) * 100}%` }}>
                    <span className="h-full bg-slate-400/70" style={{ width: `${(q.metaCost / q.total) * 100}%` }} />
                    <span className="h-full bg-rose-400" style={{ width: `${(q.markupCost / q.total) * 100}%` }} />
                    <span className="h-full flex-1 bg-amber-400" />
                  </span>
                }
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-lp-subtle">
          <Legend className="bg-slate-400/70" label="Meta's message cost" />
          <Legend className="bg-rose-400" label="Their markup" />
          <Legend className="bg-amber-400" label="Their monthly plan" />
        </div>

        <a
          href="#join"
          className="group mt-8 inline-flex items-center gap-2 rounded-full border border-lp-accent-line bg-lp-accent-soft px-5 py-2.5 text-sm font-semibold text-lp-accent transition hover:-translate-y-0.5"
        >
          Join the waitlist
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </div>
  )
}

function Row({ name, detail, total, bar, highlight }: { name: string; detail: string; total: number; bar: ReactNode; highlight?: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-lp-fg">
            {name}
            {highlight && (
              <span className="rounded-full bg-lp-btn px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-white">
                You
              </span>
            )}
          </p>
          <p className="truncate text-xs text-lp-subtle">{detail}</p>
        </div>
        <p className={cn("font-lcd shrink-0 text-lg font-bold tabular-nums", highlight ? "text-lp-accent" : "text-lp-fg")}>{formatInr(total)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-lp-line">{bar}</div>
    </>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  )
}
