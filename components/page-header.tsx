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
  /** Right-aligned actions (buttons, etc.). */
  actions?: ReactNode
  /** Optional leading element (icon, avatar, active-number badge). */
  icon?: ReactNode
  className?: string
}

/**
 * Shared page header for the dashboard revamp — title, optional breadcrumbs,
 * description, and an action slot. Responsive: actions wrap below the title on
 * narrow screens. Use at the top of every dashboard page.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
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
                    <Link href={crumb.href} className="hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast && "text-foreground font-medium")}>{crumb.label}</span>
                  )}
                  {!isLast && <ChevronRight className="h-3 w-3 opacity-60" />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h1 className="responsive-heading truncate">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
