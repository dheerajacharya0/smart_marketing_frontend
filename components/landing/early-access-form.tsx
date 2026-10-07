"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Lock } from "lucide-react"

export function EarlyAccessForm({ next }: { next: string }) {
  const [password, setPassword] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending || !password) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? "That password isn't right." : "Something went wrong. Please try again.")
        setSending(false)
        return
      }
      // Full navigation so middleware sees the new cookie.
      window.location.assign(next)
    } catch {
      setError("You seem to be offline. Please try again.")
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <label htmlFor="access-password" className="sr-only">
        Access password
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id="access-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Access password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "access-error" : undefined}
          className="h-12 w-full rounded-xl border border-lp-line-strong bg-lp-input pl-11 pr-4 text-[0.95rem] text-lp-fg outline-none transition placeholder:text-lp-subtle focus-visible:border-lp-accent-line focus-visible:ring-4 focus-visible:ring-blue-500/15"
        />
      </div>
      {error && (
        <p id="access-error" role="alert" className="text-sm text-rose-500">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !password}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-[0.95rem] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(37,99,235,0.6)] transition hover:brightness-110 disabled:opacity-60"
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
      </button>
    </form>
  )
}
