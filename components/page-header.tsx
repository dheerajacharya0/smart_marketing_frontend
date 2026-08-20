import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Breadcrumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Trail shown above the title. Last item is treated as current (no link). */
  breadcrumbs?: Breadcrumb[]
  /** Small label above the title — section, status, or count. */
  eyebrow?: ReactNode
  /** Right-aligned actions (buttons, etc.). */
  actions?: ReactNode
  /** Optional leading element (icon, avatar, active-number badge). */
  icon?: ReactNode
  className?: string
}

/**
 * Page header for every dashboard screen. Restrained by design: one display-face
 * line, a quiet supporting sentence, and the actions kept visually lighter than
 * the title so the eye lands on the page's subject first.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  eyebrow,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <li key={i} className="flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors duration-fast ease-out-soft hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast && "font-medium text-foreground")}>{crumb.label}</span>
                  )}
                  {!isLast && <ChevronRight className="h-3 w-3 opacity-50" />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <div className="mt-1 shrink-0">{icon}</div>}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-label text-primary">
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-2xl font-semibold leading-tight tracking-display text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
