"use client"

import { useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { compare, formatInr, META_RATES_INR, type MessageCategory } from "@/lib/savings"

const MAX_DIGITS = 8
const CATEGORIES: { key: MessageCategory; label: string }[] = [
  { key: "marketing", label: "Marketing" },
  { key: "utility", label: "Utility" },
  { key: "authentication", label: "OTP" },
]
const PRESETS = [
  { label: "1,000", value: 1_000 },
  { label: "10,000", value: 10_000 },
  { label: "50,000", value: 50_000 },
  { label: "1,00,000", value: 100_000 },
]

const grouped = new Intl.NumberFormat("en-IN")

/**
 * One input, one toggle, one answer: what you'd pay vs. what other tools
 * charge. The old version (numeric keypad + per-competitor markup bars) was
 * accurate but too much to parse at a glance — this keeps the same numbers,
 * simpler to read.
 */
export function Calculator() {
  const [digits, setDigits] = useState("25000")
  const [category, setCategory] = useState<MessageCategory>("marketing")

  const messages = Number(digits || "0")
  const result = useMemo(() => compare(messages, category), [messages, category])
  const avgTotal = result.theirs.reduce((sum, q) => sum + q.total, 0) / result.theirs.length

  function onChange(raw: string) {
    setDigits(raw.replace(/\D/g, "").slice(0, MAX_DIGITS))
  }

  return (
    <div className="lp-glow-border mx-auto max-w-xl rounded-[2rem] bg-lp-card p-6 shadow-[var(--lp-shadow)] sm:p-8">
      <label htmlFor="calc-messages" className="text-sm font-semibold text-lp-fg">
        How many WhatsApp messages do you send a month?
      </label>
      <input
        id="calc-messages"
        type="text"
        inputMode="numeric"
        aria-label="Monthly messages"
        value={grouped.format(messages)}
        onChange={(e) => onChange(e.target.value)}
        className="font-landing mt-3 w-full rounded-2xl border border-lp-line bg-lp-elev px-4 py-3 text-3xl font-bold tabular-nums text-lp-fg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setDigits(String(p.value))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              messages === p.value
                ? "border-lp-accent-line bg-lp-accent-soft text-lp-accent"
                : "border-lp-line text-lp-muted hover:border-lp-line-strong hover:text-lp-fg",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Message type" className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[var(--calc-seg)] p-1">
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
      <p className="mt-2 text-xs text-lp-subtle">Meta charges ₹{META_RATES_INR[category]} per message, set by Meta — same for everyone.</p>

      <div className="mt-7 grid grid-cols-2 gap-4 border-t border-lp-line pt-6 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-lp-muted">With Converszio</p>
          <p className="font-landing mt-1 text-2xl font-bold text-lp-accent sm:text-3xl">{formatInr(result.ours.total)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-lp-muted">Other tools, on average</p>
          <p className="font-landing mt-1 text-2xl font-bold text-lp-fg sm:text-3xl">{formatInr(avgTotal)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-lp-accent-soft px-5 py-4 text-center">
        <p className="text-sm font-medium text-lp-muted">You save up to</p>
        <p className="font-landing lp-gradient-text text-3xl font-extrabold tabular-nums sm:text-4xl">
          {formatInr(result.maxSavings)}
          <span className="text-base font-semibold">/mo</span>
        </p>
        <p className="mt-1 text-xs text-lp-subtle">that&apos;s {formatInr(result.maxSavings * 12)} a year</p>
      </div>

      <a
        href="#join"
        className="group mt-6 flex items-center justify-center gap-2 rounded-full bg-lp-btn px-5 py-3 text-sm font-semibold text-white transition hover:bg-lp-btn-hover"
      >
        Join the waitlist
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </a>
    </div>
  )
}
