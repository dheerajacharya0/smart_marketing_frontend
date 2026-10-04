"use client"

import { useState } from "react"
import { BellRing, CalendarCheck, KeyRound, PartyPopper, ShoppingCart, Truck, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { META_RATES_INR } from "@/lib/savings"
import { PhoneChat } from "@/components/landing/phone"
import { USE_CASES } from "@/components/landing/use-cases-data"

const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  cod: Truck,
  festive: PartyPopper,
  clinic: CalendarCheck,
  invoice: BellRing,
  otp: KeyRound,
}

const CATEGORY_LABEL = { marketing: "Marketing", utility: "Utility", authentication: "Authentication" } as const

/** Seconds each story plays before the next one takes over (until someone picks one). */
const AUTO_ADVANCE_S = 13

export function UseCases() {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const current = USE_CASES[active]

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-[1fr_auto] lg:gap-20">
      {/* Phones and tablets: a swipeable pill row directly above the chat, so
          the conversation a tap starts is on screen. The stacked list below
          would leave the phone 600px further down. */}
      {/* min-w-0: the pill row is wider than the screen by design (it scrolls);
          without it the grid track grows to fit and clips the phone. */}
      <div className="min-w-0 lg:hidden">
        <div role="tablist" aria-label="WhatsApp use cases" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {USE_CASES.map((u, i) => {
            const Icon = ICONS[u.id]
            const on = i === active
            return (
              <button
                key={u.id}
                role="tab"
                aria-selected={on}
                onClick={(e) => {
                  setActive(i)
                  setAuto(false)
                  e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
                }}
                className={cn(
                  "flex shrink-0 snap-center items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                  on
                    ? "border-transparent bg-gradient-to-r from-teal-300 to-cyan-300 text-slate-950 shadow-[0_6px_20px_-6px_rgba(45,212,191,0.7)]"
                    : "border-lp-line bg-lp-card text-lp-text",
                )}
              >
                <Icon className="size-4" />
                {u.label}
              </button>
            )
          })}
        </div>
        <div key={current.id} className="lp-pop mt-4 rounded-2xl border border-lp-line bg-lp-card p-4">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-lp-subtle">{current.industry}</p>
          <p className="mt-1 text-sm leading-relaxed text-lp-muted">{current.pitch}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-lp-line bg-lp-card px-2.5 py-1 text-[0.7rem] text-lp-text">
            <span className="size-1.5 rounded-full bg-teal-400" />
            Meta bills this as {CATEGORY_LABEL[current.category]} · ₹{META_RATES_INR[current.category]}/msg
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="WhatsApp use cases" className="hidden content-start gap-2.5 lg:grid">

        {USE_CASES.map((u, i) => {
          const Icon = ICONS[u.id]
          const on = i === active
          return (
            <button
              key={u.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setActive(i)
                setAuto(false)
              }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300",
                on
                  ? "border-lp-accent-line bg-lp-accent-soft shadow-[0_0_40px_-12px_rgba(45,212,191,0.45)]"
                  : "border-lp-line bg-lp-card hover:-translate-y-0.5 hover:border-lp-line-strong hover:bg-lp-card-hover",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl transition duration-300",
                    on
                      ? "rotate-[-6deg] scale-110 bg-gradient-to-br from-teal-300 to-cyan-400 text-slate-950 shadow-[0_8px_20px_-6px_rgba(45,212,191,0.7)]"
                      : "bg-lp-card-hover text-lp-muted group-hover:text-lp-fg",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-lp-subtle">{u.industry}</span>
                  <span className="block font-semibold text-lp-fg">{u.label}</span>
                </span>
              </div>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-500",
                  on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="pt-3 text-sm leading-relaxed text-lp-muted">{u.pitch}</p>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-lp-line bg-lp-card px-2.5 py-1 text-[0.7rem] text-lp-text">
                    <span className="size-1.5 rounded-full bg-teal-400" />
                    Meta bills this as {CATEGORY_LABEL[u.category]} · ₹{META_RATES_INR[u.category]}/msg
                  </p>
                </div>
              </div>
              {on && auto && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-teal-300 to-blue-400"
                  style={{ animation: `lp-progress ${AUTO_ADVANCE_S}s linear forwards` }}
                  onAnimationEnd={() => setActive((a) => (a + 1) % USE_CASES.length)}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="relative mx-auto">
        <div aria-hidden="true" className="absolute inset-0 -z-10 scale-110 rounded-full bg-gradient-to-br from-teal-400/25 via-blue-500/15 to-violet-500/25 blur-3xl" />
        <PhoneChat key={current.id} business={current.business} script={current.script} />
      </div>
    </div>
  )
}
