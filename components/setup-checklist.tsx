"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import { useSetupChecklist, type SetupStep } from "@/hooks/use-setup-checklist"
import { cn } from "@/lib/utils"

function StepRow({ step, index, className }: { step: SetupStep; index: number; className?: string }) {
  return (
    <li className={cn("flex items-start gap-3 py-3 border-b border-border/40 last:border-0", className)}>
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
          step.done
            ? "border-success/40 bg-success/10 text-success"
            : "border-border text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
      </span>

      {/* Actions sit under the text on a phone: beside it, two buttons left the
          description a column a word or two wide. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              step.done && "text-muted-foreground line-through decoration-muted-foreground/40"
            )}
          >
            {step.title}
          </p>
          {!step.done && (
            <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
          )}
        </div>

        {!step.done && (
          <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
            {step.secondary && !step.blocked ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={step.secondary.onClick}
                disabled={step.secondary.pending}
              >
                {step.secondary.label}
              </Button>
            ) : null}
            {step.id === "connect" ? (
              <ConnectWhatsAppButton label={step.cta} size="sm" variant="outline" />
            ) : step.blocked ? (
              <Button
                size="sm"
                variant="ghost"
                disabled
                title="Finish the steps above first"
                className="text-muted-foreground"
              >
                {step.cta}
              </Button>
            ) : step.external ? (
              // Meta's own settings: a plain anchor in a new tab, so the
              // checklist is still here when they come back.
              <Button asChild size="sm" variant="outline">
                <a href={step.href} target="_blank" rel="noreferrer">
                  {step.cta}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={step.href as string}>
                  {step.cta}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/** Completion as a ring — the phone header, where a full-width bar reads as a divider. */
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? completed / total : 0
  return (
    <div className="relative h-12 w-12 shrink-0" aria-hidden>
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="4" className="stroke-secondary" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-slow ease-out-soft"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {completed}/{total}
      </span>
    </div>
  )
}

/**
 * First-run guided setup (§"newbie mode" #1): the path from an empty account to
 * a first sent message, with every step's done-state read from a real backend
 * signal rather than local progress tracking.
 *
 * Renders nothing once all steps pass or the user dismisses it, so it costs an
 * established account no space — and nothing while it is still finding out.
 * It used to show a skeleton meanwhile, which on an account that turned out to
 * be fully set up meant a big card that appeared, loaded, then vanished and
 * pulled the analytics up the page. Arriving a moment late beats that.
 */
export function SetupChecklist({ accountId }: { accountId: string | null | undefined }) {
  const { steps, completed, total, loading, hidden, dismiss } = useSetupChecklist(accountId)
  // Phones show only the next step until asked: seven rows of mostly-done
  // setup is a screen and a half of scrolling before any real content.
  const [expanded, setExpanded] = useState(false)

  if (hidden || loading) return null

  const nextIndex = steps.findIndex((step) => !step.done)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="sm:hidden">
          <ProgressRing completed={completed} total={total} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle>Finish setting up</CardTitle>
          <CardDescription>
            {completed} of {total} done — these get you to your first message.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="h-8 w-8 shrink-0 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 max-sm:space-y-0">
        <Progress
          className="max-sm:hidden"
          value={total > 0 ? (completed / total) * 100 : 0}
          aria-label={`Setup progress: ${completed} of ${total} steps complete`}
        />

        <ul>
          {steps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              index={i}
              className={cn(!expanded && i !== nextIndex && "max-sm:hidden")}
            />
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="w-full sm:hidden"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show all ${total} steps`}
        </Button>
      </CardContent>
    </Card>
  )
}
