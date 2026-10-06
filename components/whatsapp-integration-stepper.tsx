"use client"

import { usePathname } from "next/navigation"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The guided setup's steps, in order, as the user sees them. Index 0 is the
 * Facebook page at /dashboard/whatsapp/new; the rest map from the
 * `[wabaId]/(onboarding)/step-N` routes through `ROUTE_STEP`. Adding,
 * removing or reordering a step means updating both together.
 *
 * Activation (subscribing our app to the WABA) used to be its own step — one
 * button with nothing to decide. Step 2 now does it as soon as the number is
 * registered; the step-3 route remains only as the fallback when that
 * automatic activation fails, and shows as part of "WhatsApp number".
 */
export const ONBOARDING_STEPS = ["Facebook", "Business", "WhatsApp number", "Done"] as const

const ROUTE_STEP: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3 }

/** Which visible step a path is on: `/new` is 0, `…/step-N` maps through ROUTE_STEP. */
export function onboardingStepIndex(pathname: string): number {
  const match = pathname.match(/\/step-(\d+)\/?$/)
  if (!match) return 0
  return ROUTE_STEP[Number.parseInt(match[1], 10)] ?? 0
}

export function WhatsAppIntegrationStepper() {
  const pathname = usePathname()
  const current = onboardingStepIndex(pathname ?? "")
  const total = ONBOARDING_STEPS.length

  return (
    <nav aria-label="Setup progress" className="w-full">
      {/* Phones: one line and a bar. Five labelled circles don't fit. */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{ONBOARDING_STEPS[current]}</span>
          <span className="text-muted-foreground">
            Step {current + 1} of {total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-base ease-out-soft"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden items-start sm:flex">
        {ONBOARDING_STEPS.map((name, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={name} className="relative flex flex-1 flex-col items-center" aria-current={active ? "step" : undefined}>
              {/* Connector to the next step, drawn from this circle's centre. */}
              {i < total - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2 transition-colors",
                    done ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-base",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !done && !active && "border-2 border-border bg-background text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-2 px-1 text-center text-xs",
                  active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {name}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
