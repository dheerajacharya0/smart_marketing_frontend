"use client"

import { useId, useState, type FormEvent } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string }

interface WaitlistFormProps {
  source: string
  /** Calculator figures sent along with the email, if the form sits beside it. */
  context?: () => { monthlyMessages?: number; monthlySavings?: number }
  cta?: string
  className?: string
}

export function WaitlistForm({ source, context, cta = "Get early access", className }: WaitlistFormProps) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (status.kind === "sending") return
    setStatus({ kind: "sending" })
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source, ...context?.() }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? "Something went wrong. Please try again." })
        return
      }
      setStatus({ kind: "done" })
    } catch {
      setStatus({ kind: "error", message: "You seem to be offline. Please try again." })
    }
  }

  if (status.kind === "done") {
    return (
      <div
        role="status"
        className={cn(
          "lp-pop flex items-center gap-3 rounded-xl border border-lp-accent-line bg-lp-accent-soft px-4 py-3.5 text-[0.95rem] text-lp-fg",
          className,
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal-500 text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span>
          You&apos;re on the list. We&apos;ll email <strong className="font-semibold">{email}</strong> the day we launch.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status.kind === "error") setStatus({ kind: "idle" })
          }}
          aria-invalid={status.kind === "error"}
          aria-describedby={status.kind === "error" ? `${id}-error` : undefined}
          className="h-12 w-full min-w-0 rounded-xl border border-lp-line-strong sm:flex-1 bg-lp-input px-4 text-[0.95rem] text-lp-fg shadow-sm outline-none transition placeholder:text-lp-subtle focus-visible:border-lp-accent-line focus-visible:ring-4 focus-visible:ring-teal-400/15"
        />
        {/* Honeypot: off-screen and out of the tab order, so only bots fill it. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="absolute -left-[9999px] h-px w-px opacity-0"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={status.kind === "sending"}
          className="lp-shine group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-300 bg-[length:200%_100%] px-6 text-[0.95rem] font-semibold text-slate-950 shadow-[0_8px_30px_-8px_rgba(45,212,191,0.6)] transition-[background-position,transform] duration-500 hover:bg-[position:100%_0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/30 disabled:opacity-70"
        >
          {status.kind === "sending" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>
      {status.kind === "error" ? (
        <p id={`${id}-error`} role="alert" className="mt-2.5 text-sm text-rose-500">
          {status.message}
        </p>
      ) : (
        <p className="mt-2.5 text-[0.8rem] text-lp-subtle">No spam. One email when we launch — that&apos;s it.</p>
      )}
    </form>
  )
}
