"use client"

import { useId, useState, type FormEvent } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Length of the free trial every new account gets. Mirrors TRIAL_PERIOD_MS in
 * backend-wb `src/auth/auth.service.ts`; change both together. Copy says only
 * that the trial is free, never what follows it: Starter may be charged later.
 */
export const TRIAL_DAYS = 30

/** Signup URL with the address prefilled; the login page reads `mode` and `email`. */
export function signupHref(email?: string): string {
  const params = new URLSearchParams({ mode: "signup" })
  const trimmed = email?.trim()
  if (trimmed) params.set("email", trimmed)
  return `/login?${params.toString()}`
}

/**
 * Landing-page signup start: the visitor types their email here and finishes
 * creating the account on /login with it filled in. Nothing is sent from this
 * form; an empty email still goes through to a blank signup form.
 */
export function SignupStart({ cta = "Get started", className }: { cta?: string; className?: string }) {
  const id = useId()
  const [email, setEmail] = useState("")

  function submit(event: FormEvent) {
    event.preventDefault()
    window.location.assign(signupHref(email))
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
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full min-w-0 rounded-xl border border-lp-line-strong sm:flex-1 bg-lp-input px-4 text-[0.95rem] text-lp-fg shadow-sm outline-none transition placeholder:text-lp-subtle focus-visible:border-lp-accent-line focus-visible:ring-4 focus-visible:ring-blue-500/15"
        />
        <button
          type="submit"
          className="lp-shine group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 bg-[length:200%_100%] px-6 text-[0.95rem] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(37,99,235,0.6)] transition-[background-position,transform] duration-500 hover:bg-[position:100%_0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
        >
          {cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
      <p className="mt-2.5 text-[0.8rem] text-lp-subtle">
        <span className="font-medium text-lp-text">{TRIAL_DAYS}-day free trial, no card needed.</span> Already have an account?{" "}
        <a href="/login" className="font-medium text-lp-accent underline-offset-4 hover:underline">
          Log in
        </a>
      </p>
    </form>
  )
}
