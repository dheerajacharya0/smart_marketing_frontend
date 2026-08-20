"use client"

import Link from "next/link"
import { Check, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import { useSetupChecklist, type SetupStep } from "@/hooks/use-setup-checklist"
import { cn } from "@/lib/utils"

function StepRow({ step, index }: { step: SetupStep; index: number }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
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
        <div className="shrink-0">
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
    </li>
  )
}

/**
 * First-run guided setup (§"newbie mode" #1): the path from an empty account to
 * a first sent message, with every step's done-state read from a real backend
 * signal rather than local progress tracking.
 *
 * Renders nothing once all steps pass or the user dismisses it, so it costs an
 * established account no space.
 */
export function SetupChecklist({ accountId }: { accountId: string | null | undefined }) {
  const { steps, completed, total, loading, hidden, dismiss } = useSetupChecklist(accountId)

  if (hidden) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Finish setting up</CardTitle>
          <CardDescription>
            {loading
              ? "Checking what's left…"
              : `${completed} of ${total} done — these get you to your first message.`}
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

      <CardContent className="space-y-4">
        <Progress
          value={total > 0 ? (completed / total) * 100 : 0}
          aria-label={`Setup progress: ${completed} of ${total} steps complete`}
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul>
            {steps.map((step, i) => (
              <StepRow key={step.id} step={step} index={i} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
