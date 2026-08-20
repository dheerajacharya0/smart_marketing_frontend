import type { ComponentType, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  /** lucide icon component, e.g. `Inbox`. */
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  /** Primary CTA(s) — buttons/links. */
  action?: ReactNode
  /** Smaller secondary link under the action (e.g. "Learn more"). */
  secondaryAction?: ReactNode
  /** Contextual guidance shown under the CTA — what this screen is for. */
  hint?: ReactNode
  /** Drop the ambient wash — for empty states inside small panels. */
  plain?: boolean
  /** Add WhatsApp's chat texture. For inbox and conversation surfaces. */
  doodle?: boolean
  className?: string
}

/**
 * Empty states are the first thing a new account sees on most screens, so they
 * get real design rather than a grey "no data" line: a soft illustrated mark,
 * plain-language explanation, one clear action, and optional guidance.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  hint,
  plain,
  doodle,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden px-6 py-14 text-center",
        className,
      )}
    >
      {!plain && (
        <>
          {/* Ambient wash, not a picture — it gives the space depth without
              inventing an illustration style the rest of the app doesn't use. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[var(--ambient-opacity)]"
            style={{
              backgroundImage:
                "radial-gradient(28rem 16rem at 50% 8%, hsl(var(--primary) / 0.12), transparent 68%), radial-gradient(20rem 14rem at 78% 92%, hsl(var(--accent-vivid) / 0.1), transparent 70%)",
            }}
          />
          {doodle && (
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 doodle-wallpaper" />
          )}
        </>
      )}

      {Icon && (
        <div className="relative mb-5">
          {/* Soft halo behind the mark, so the icon reads as lit rather than stamped. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-[1.6] rounded-full blur-xl"
            style={{ background: "hsl(var(--primary) / 0.18)" }}
          />
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 shadow-sm">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        </div>
      )}

      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}

      {action && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div>
      )}

      {secondaryAction && <div className="mt-3 text-sm text-muted-foreground">{secondaryAction}</div>}

      {hint && (
        <p className="mt-6 max-w-md rounded-md border border-border-subtle/70 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
