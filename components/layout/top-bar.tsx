"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { CommandPaletteTrigger } from "@/components/command-palette"
import { ThemeSelector } from "@/components/theme-selector"
import { useAccountId } from "@/hooks/use-account-id"
import { useAlerts } from "@/hooks/use-queries"
import { cn } from "@/lib/utils"

/**
 * The dashboard's top rail: sidebar control, search, notifications, theme, and
 * whatever the current page wants to put in the contextual slot.
 *
 * It is sticky and translucent rather than a solid bar — content scrolls under
 * it and stays faintly visible, which keeps the page feeling continuous
 * instead of chopped into a header and a body.
 */
export function TopBar({
  actions,
  className,
}: {
  /** Contextual, page-supplied controls. */
  actions?: React.ReactNode
  className?: string
}) {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const { accountId } = useAccountId()
  const { data: alerts } = useAlerts(accountId)
  const alertCount = (alerts ?? []).filter((a) => !a.acknowledged).length

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border-subtle/70",
        "bg-background/70 backdrop-blur-xl supports-[not(backdrop-filter:blur(0))]:bg-background",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </Button>

        {/* Search is the widest thing in the bar on desktop and collapses to a
            tap target on phones, where there is no keyboard shortcut. */}
        <div className="flex min-w-0 flex-1 items-center">
          <CommandPaletteTrigger className="w-full max-w-sm" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actions}

          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={alertCount > 0 ? `Notifications, ${alertCount} unread` : "Notifications"}
            className={cn(
              "relative h-9 w-9 rounded-md",
              pathname?.startsWith("/dashboard/notifications") && "text-primary",
            )}
          >
            <Link href="/dashboard/notifications">
              <Bell className="h-[18px] w-[18px]" />
              {alertCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="signal-ping absolute inline-flex h-full w-full rounded-full bg-primary" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              )}
            </Link>
          </Button>

          <ThemeSelector />
        </div>
      </div>
    </header>
  )
}
