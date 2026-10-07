"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Megaphone,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Send,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useAccountId } from "@/hooks/use-account-id"
import { useUnreadTotal } from "@/hooks/use-queries"
import { useAccountRole } from "@/hooks/use-account-role"
import { canOpen } from "@/lib/access"
import { cn } from "@/lib/utils"

/**
 * Whether the tab bar is on screen for this route. An open conversation owns the
 * bottom edge for its composer, and a bar under the keyboard-side input would
 * cover the thing being typed into.
 */
export function showsMobileTabBar(pathname: string | null) {
  return !(pathname?.startsWith("/dashboard/chat/") ?? false)
}

interface Tab {
  href: string
  label: string
  icon: LucideIcon
  /** `/dashboard` itself is only active on the exact path, not on every page under it. */
  exact?: boolean
}

const TABS_LEFT: Tab[] = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/chat", label: "Inbox", icon: MessageSquare },
]
const TABS_RIGHT: Tab[] = [{ href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone }]

const QUICK_ACTIONS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  {
    href: "/dashboard/campaigns?new=1",
    label: "Send a broadcast",
    hint: "A template to many contacts at once",
    icon: Send,
  },
  {
    href: "/dashboard/chat/new",
    label: "New conversation",
    hint: "Message one person",
    icon: MessageSquarePlus,
  },
  {
    href: "/dashboard/contacts?import=1",
    label: "Import contacts",
    hint: "From a CSV file",
    icon: Upload,
  },
  { href: "/dashboard/billing", label: "Top up wallet", icon: Wallet, hint: "Add credit for sending" },
]

function TabLink({ tab, active, badge }: { tab: Tab; active: boolean; badge?: number }) {
  const Icon = tab.icon
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground active:text-foreground",
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-primary-soft",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        {badge ? (
          <span className="absolute -right-0.5 -top-1 min-w-[1.125rem] rounded-full bg-destructive px-1 text-center text-[0.625rem] font-semibold leading-[1.125rem] text-destructive-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      {tab.label}
    </Link>
  )
}

/**
 * Phone navigation: the four places people go most, in thumb reach, plus a
 * create button. Everything else stays one tap away behind "More", which opens
 * the existing sidebar drawer — so no destination exists only on desktop.
 *
 * Below `md` only, matching the sidebar's own switch to a drawer.
 */
export function MobileTabBar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const { accountId } = useAccountId()
  // Same cache entry as the sidebar badge, so the two can't disagree.
  const { data: unread } = useUnreadTotal(accountId)
  const [createOpen, setCreateOpen] = useState(false)
  const { role } = useAccountRole()
  const quickActions = QUICK_ACTIONS.filter((action) => !role || canOpen(role, action.href))

  if (!showsMobileTabBar(pathname)) return null

  const isActive = (tab: Tab) =>
    tab.exact ? pathname === tab.href : (pathname?.startsWith(tab.href) ?? false)

  return (
    <>
      <nav
        aria-label="Main"
        className={cn(
          // In flow at the bottom of the dashboard column (see dashboard layout),
          // raised so the create button's lift paints over the page above it.
          "relative z-40 shrink-0 md:hidden",
          "border-t border-border/60 bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
          {TABS_LEFT.map((tab) => (
            <TabLink
              key={tab.href}
              tab={tab}
              active={isActive(tab)}
              badge={tab.href === "/dashboard/chat" ? unread?.total : undefined}
            />
          ))}

          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label="Create"
              className={cn(
                "flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl",
                "btn-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                "ring-4 ring-background transition-transform active:scale-95",
              )}
            >
              <Plus className="h-6 w-6" strokeWidth={2.25} />
            </button>
          </div>

          {TABS_RIGHT.map((tab) => (
            <TabLink key={tab.href} tab={tab} active={isActive(tab)} />
          ))}

          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-muted-foreground active:text-foreground"
          >
            <span className="flex h-7 w-12 items-center justify-center">
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </span>
            More
          </button>
        </div>
      </nav>

      <Drawer open={createOpen} onOpenChange={setCreateOpen} shouldScaleBackground={false}>
        <DrawerContent className="rounded-t-3xl border-border/60 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Create</DrawerTitle>
            <DrawerDescription>What would you like to start?</DrawerDescription>
          </DrawerHeader>
          <ul className="grid gap-1 px-2">
            {quickActions.map(({ href, label, hint, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setCreateOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors active:bg-muted"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  )
}
