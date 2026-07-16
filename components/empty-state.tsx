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
  className?: string
}

/**
 * Consistent empty state for every list/table/first-run across the app. Icon,
 * plain-language explainer, primary CTA. Replaces ad-hoc "no data" blocks.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <Icon className="h-7 w-7 text-accent-foreground" />
        </div>
      )}
      <h3 className="text-lg font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
      {secondaryAction && (
        <div className="mt-3 text-sm text-muted-foreground">{secondaryAction}</div>
      )}
    </div>
  )
}
