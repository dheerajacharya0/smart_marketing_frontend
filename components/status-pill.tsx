import type { ReactNode } from "react"
import { AlertCircle, Check, Clock, Pause } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The four states of the Signal status language, borrowed from WhatsApp's own
 * delivery ticks so users learn it once and read it everywhere:
 *
 *   queued    — one grey tick    (waiting, scheduled, draft)
 *   delivered — two grey ticks   (sent, in flight, running)
 *   read      — two green ticks  (read, completed, succeeded, active)
 *   failed    — red alert        (failed, rejected, blocked)
 *   paused    — grey pause       (deliberately stopped by a human)
 */
export type TickState = "queued" | "delivered" | "read" | "failed" | "paused"

/** Raw API enums mapped onto the five states. Extend here, not at call sites. */
const STATUS_MAP: Record<string, TickState> = {
  // queued
  queued: "queued",
  pending: "queued",
  scheduled: "queued",
  draft: "queued",
  submitted: "queued",
  processing: "queued",
  // delivered
  sent: "delivered",
  sending: "delivered",
  delivered: "delivered",
  running: "delivered",
  in_progress: "delivered",
  // read
  read: "read",
  completed: "read",
  complete: "read",
  success: "read",
  succeeded: "read",
  active: "read",
  approved: "read",
  verified: "read",
  connected: "read",
  // failed
  failed: "failed",
  error: "failed",
  rejected: "failed",
  blocked: "failed",
  cancelled: "failed",
  canceled: "failed",
  undelivered: "failed",
  // paused
  paused: "paused",
  stopped: "paused",
  inactive: "paused",
  disabled: "paused",
}

/** Plain-language label per raw status — never show the user `TIER_1K`. */
const LABEL_MAP: Record<string, string> = {
  queued: "Queued",
  pending: "Waiting",
  scheduled: "Scheduled",
  draft: "Draft",
  submitted: "Submitted",
  processing: "Processing",
  sent: "Sent",
  sending: "Sending",
  delivered: "Delivered",
  running: "Running",
  in_progress: "In progress",
  read: "Read",
  completed: "Completed",
  complete: "Completed",
  success: "Succeeded",
  succeeded: "Succeeded",
  active: "Active",
  approved: "Approved",
  verified: "Verified",
  connected: "Connected",
  failed: "Failed",
  error: "Failed",
  rejected: "Rejected",
  blocked: "Blocked",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  undelivered: "Not delivered",
  paused: "Paused",
  stopped: "Stopped",
  inactive: "Inactive",
  disabled: "Turned off",
}

export function tickStateOf(status: string): TickState {
  return STATUS_MAP[status?.toLowerCase?.().replace(/[\s-]/g, "_")] ?? "queued"
}

export function statusLabelOf(status: string): string {
  const key = status?.toLowerCase?.().replace(/[\s-]/g, "_")
  if (LABEL_MAP[key]) return LABEL_MAP[key]
  // Fall back to Sentence case rather than leaking a raw enum.
  return key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ") : "Unknown"
}

const tickColor: Record<TickState, string> = {
  queued: "text-tick-queued",
  delivered: "text-tick-delivered",
  read: "text-tick-read",
  failed: "text-tick-failed",
  paused: "text-tick-queued",
}

const pillClass: Record<TickState, string> = {
  queued: "border-tick-queued/30 bg-tick-queued/10 text-tick-queued",
  delivered: "border-tick-delivered/30 bg-tick-delivered/10 text-tick-delivered",
  read: "border-tick-read/30 bg-tick-read/10 text-tick-read",
  failed: "border-tick-failed/30 bg-tick-failed/10 text-tick-failed",
  paused: "border-tick-queued/30 bg-tick-queued/10 text-tick-queued",
}

interface TickProps {
  state: TickState
  className?: string
}

/**
 * The tick glyph on its own — one tick, two ticks, two green ticks, or an
 * alert. Shape carries the meaning as well as color, so the state survives
 * greyscale and color-blind viewing.
 */
export function Tick({ state, className }: TickProps) {
  if (state === "failed") {
    return <AlertCircle className={cn("h-3.5 w-3.5", tickColor.failed, className)} aria-hidden />
  }

  if (state === "paused") {
    return <Pause className={cn("h-3.5 w-3.5", tickColor.paused, className)} aria-hidden />
  }

  if (state === "queued") {
    return <Clock className={cn("h-3.5 w-3.5", tickColor.queued, className)} aria-hidden />
  }

  // delivered / read — the double tick, offset so it reads as WhatsApp's
  return (
    <span className={cn("relative inline-flex h-3.5 w-[18px] shrink-0", tickColor[state], className)} aria-hidden>
      <Check className="absolute left-0 top-0 h-3.5 w-3.5" strokeWidth={3} />
      <Check className="absolute left-[5px] top-0 h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
}

interface StatusPillProps {
  /** Raw status from the API. Mapped to a tick state and plain-language label. */
  status: string
  /** Override the label if the surface needs different wording. */
  label?: ReactNode
  /** Hide the text and show only the tick (dense tables). */
  iconOnly?: boolean
  /** Pulse the pill — for states that are actively changing right now. */
  live?: boolean
  className?: string
}

/**
 * Status shown the WhatsApp way. Replaces every raw enum badge in the app —
 * campaigns, inbox, flows, drips all read from the same vocabulary.
 */
export function StatusPill({ status, label, iconOnly, live, className }: StatusPillProps) {
  const state = tickStateOf(status)
  const text = label ?? statusLabelOf(status)

  if (iconOnly) {
    return (
      <span className={cn("inline-flex items-center", className)} title={typeof text === "string" ? text : undefined}>
        <Tick state={state} />
        <span className="sr-only">{text}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        "transition-colors duration-fast ease-out-soft",
        pillClass[state],
        className,
      )}
    >
      {live ? <LiveDot tone={state === "failed" ? "danger" : "primary"} /> : <Tick state={state} />}
      {text}
    </span>
  )
}

interface LiveDotProps {
  tone?: "primary" | "danger" | "muted"
  /** Turn off the pulse — a dot that is present but not currently active. */
  idle?: boolean
  className?: string
}

const dotTone = {
  primary: "bg-primary",
  danger: "bg-tick-failed",
  muted: "bg-muted-foreground",
}

/**
 * Pulsing dot meaning "happening right now" — sending, agent typing, flow
 * executing. Per the Signal rules, glow and pulse are reserved for live state,
 * so this component is the only place a halo is allowed to breathe.
 */
export function LiveDot({ tone = "primary", idle, className }: LiveDotProps) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)} aria-hidden>
      {!idle && (
        <span className={cn("absolute inset-0 rounded-full signal-ping", dotTone[tone])} />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotTone[tone], !idle && "signal-pulse")} />
    </span>
  )
}
