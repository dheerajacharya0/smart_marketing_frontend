"use client"

import type React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ONBOARDING_STEPS, WhatsAppIntegrationStepper } from "@/components/whatsapp-integration-stepper"

/**
 * Building blocks shared by every page of the guided WhatsApp setup
 * (/dashboard/whatsapp/new and the `[wabaId]/(onboarding)` steps), so the
 * five pages read as one flow rather than five forms that happen to link.
 */

/** Page frame: back to WhatsApp, the flow's title, and the stepper. */
export function OnboardingFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <div className="space-y-5">
        <Link
          href="/dashboard/whatsapp"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          WhatsApp
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Connect WhatsApp</h1>
          <p className="text-muted-foreground">Guided setup — we&apos;ll walk you through each step.</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-4 shadow-xs sm:px-6 sm:py-5">
          <WhatsAppIntegrationStepper />
        </div>
      </div>
      {children}
    </div>
  )
}

/** "Step 2 of 5", a title and what this step is for. */
export function StepHeader({
  step,
  icon,
  title,
  description,
}: {
  /** Index into ONBOARDING_STEPS. */
  step: number
  icon: React.ReactNode
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Step {step + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/** The white card a step's content sits in. */
export function StepCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border bg-card p-5 shadow-xs sm:p-6", className)}>{children}</section>
}

/** A heading inside a step card. */
export function SectionTitle({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-4 space-y-0.5">
      <h3 className="font-semibold">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Back on the left, the step's primary action on the right; stacked on phones. */
export function StepFooter({ backHref, children }: { backHref?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
      {backHref ? (
        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">{children}</div>
    </div>
  )
}

/**
 * A selectable row — a business, a WhatsApp account. Behaves as a radio:
 * `role="radio"` inside a parent with `role="radiogroup"`.
 */
export function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all duration-base ease-out-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary-soft/60 shadow-sm ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge}
        </span>
        {subtitle ? <span className="mt-0.5 block text-sm text-muted-foreground">{subtitle}</span> : null}
        {children ? <span className="mt-2 block">{children}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary bg-primary" : "border-muted-foreground/40"
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
      </span>
    </button>
  )
}

/** A small status pill. */
export function Pill({ tone, children }: { tone: "success" | "warning" | "muted" | "info"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "success" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "info" && "bg-info-soft text-info",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

const NOTE_TONE = {
  info: { icon: Info, className: "border-info/20 bg-info-soft text-info" },
  success: { icon: CheckCircle2, className: "border-success/25 bg-success-soft text-success" },
  warning: { icon: AlertTriangle, className: "border-warning/25 bg-warning-soft text-warning" },
  error: { icon: XCircle, className: "border-destructive/25 bg-destructive-soft text-destructive" },
} as const

/** An inline message where a toast used to be — it stays until it no longer applies. */
export function StatusNote({
  tone,
  title,
  children,
  action,
}: {
  tone: keyof typeof NOTE_TONE
  title?: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  const { icon: Icon, className } = NOTE_TONE[tone]
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="leading-relaxed opacity-90">{children}</div> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  )
}

/** A sub-task inside a step (add a number, verify it, set a PIN). */
export function ActionPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-xs">
          {icon}
        </span>
        <div className="min-w-0 space-y-0.5">
          <h4 className="font-semibold">{title}</h4>
          {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

/** Placeholder rows while a list loads, with what's happening said out loud. */
export function OptionListSkeleton({ label, rows = 2 }: { label: string; rows?: number }) {
  return (
    <div className="space-y-3" aria-busy>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-xl border p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A loading label for a button. */
export function Busy({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </>
  )
}
