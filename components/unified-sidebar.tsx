"use client"

import { useCallback, useEffect, useState, type ComponentType } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { logout, getUserDataFromCookie, type AuthUser } from "@/services/api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarWalletStrip } from "@/components/sidebar-wallet-strip"
import { useAccountId } from "@/hooks/use-account-id"
import { useAccountRole } from "@/hooks/use-account-role"
import { canOpen } from "@/lib/access"
import {
  queryKeys,
  useAlerts,
  useFacebookAccounts,
  useUnreadTotal,
  useWhatsappPhoneNumbers,
} from "@/hooks/use-queries"
import { useNavPrefetch } from "@/hooks/use-nav-prefetch"
import { useChatSocket } from "@/hooks/use-chat-socket"
import { useNotificationSound } from "@/hooks/use-notification-sound"
import { useDesktopNotifications } from "@/hooks/use-desktop-notifications"
import { usePushResync } from "@/hooks/use-push-notifications"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BarChart,
  Bell,
  BookOpen,
  BookUser,
  Bot,
  FileStack,
  FileText,
  Filter,
  Home,
  IndianRupee,
  LifeBuoy,
  LogOut,
  Mails,
  Link2,
  Megaphone,
  MessageSquare,
  Settings,
  User,
  Users,
  Wallet,
  Workflow,
} from "lucide-react"

type BadgeKey = "unread" | "alerts"

interface NavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Exact match only — used for the dashboard root, which every route prefixes. */
  exact?: boolean
  badge?: BadgeKey
  /** Shown in the collapsed rail's tooltip, under the label. */
  hint?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Navigation as data. The old markup repeated the same twenty-line block per
 * link, which made the rail impossible to restyle consistently — every change
 * had to be made seventeen times.
 */
const NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home, exact: true, hint: "Delivery and engagement overview" },
      { href: "/dashboard/chat", label: "Inbox", icon: MessageSquare, badge: "unread", hint: "Conversations with your customers" },
      { href: "/dashboard/contacts", label: "Contacts", icon: BookUser, hint: "Everyone you can message" },
      { href: "/dashboard/segments", label: "Segments", icon: Filter, hint: "Saved audience filters" },
      { href: "/dashboard/links", label: "Links", icon: Link2, hint: "Opt-in links and click tracking" },
    ],
  },
  {
    label: "Messaging",
    items: [
      { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone, hint: "One-off broadcasts" },
      { href: "/dashboard/templates", label: "Templates", icon: FileText, hint: "Approved messages you can broadcast" },
      { href: "/dashboard/drips", label: "Drip sequences", icon: Mails, hint: "Scheduled follow-up journeys" },
      { href: "/dashboard/automation", label: "Automation", icon: Bot, hint: "Rules that reply for you" },
      // "Chatbot flows", not "Flows": WhatsApp Forms below are also flows in
      // Meta's vocabulary, and two identically named items is the confusion
      // this label exists to prevent.
      { href: "/dashboard/flows", label: "Chatbot flows", icon: Workflow, hint: "Visual bot builder" },
      { href: "/dashboard/whatsapp-flows", label: "WhatsApp Forms", icon: FileStack, hint: "Meta's in-chat forms" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/dashboard/revenue", label: "Revenue", icon: IndianRupee, hint: "Sales reported against messaging" },
      { href: "/dashboard/api-usage", label: "API usage", icon: BarChart, hint: "Keys and endpoint metrics" },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: "alerts", hint: "Number health and delivery alerts" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/whatsapp", label: "WhatsApp setup", icon: MessageSquare, hint: "Numbers, templates, onboarding" },
      { href: "/dashboard/users", label: "Users", icon: Users, hint: "Linked Facebook users" },
      { href: "/dashboard/billing", label: "Billing", icon: Wallet, hint: "Wallet, invoices, GST" },
    ],
  },
  {
    label: "Help",
    items: [
      { href: "/dashboard/docs", label: "Documentation", icon: FileText },
      { href: "/dashboard/glossary", label: "Glossary", icon: BookOpen, hint: "Plain English for Meta's jargon" },
      { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
    ],
  },
]

const FOOTER: NavItem[] = [
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

function NavCount({ value, collapsed }: { value: number; collapsed: boolean }) {
  if (value <= 0) return null

  // Collapsed, the rail has no room for a number — a lit dot on the icon
  // carries the same "something is waiting" signal.
  if (collapsed) {
    return (
      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-sidebar-primary shadow-[0_0_8px_hsl(var(--sidebar-primary)/0.8)]" />
    )
  }

  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary/12 px-1.5 font-mono text-[11px] font-medium tabular-nums text-sidebar-primary">
      {value > 99 ? "99+" : value}
    </span>
  )
}

export default function UnifiedSidebar() {
  const pathname = usePathname()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  // The signed-in user. The cookie is client-only, so read it after mount to
  // keep the first render matching SSR.
  const [user, setUser] = useState<AuthUser | null>(null)
  useEffect(() => {
    setUser(getUserDataFromCookie())
  }, [])

  const userLabel = user?.name || user?.email || ""
  const userInitials =
    userLabel
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"

  // Unread health alerts, from the same cache entry the notifications page
  // reads — the badge used to be a hardcoded 3 that never moved.
  const { accountId } = useAccountId()
  const { role, can } = useAccountRole()
  const { data: alerts } = useAlerts(accountId, can("manager"))
  const alertCount = (alerts ?? []).filter((a) => !a.acknowledged).length

  // The header names the business you are working in, not the product: with
  // team access one person can be inside someone else's account, and a fixed
  // placeholder gave no hint of which. Meta's verified business name first,
  // then the account's own name. Both queries are already cached by the
  // pages that use them.
  const { data: accounts } = useFacebookAccounts(Boolean(accountId))
  const { data: phoneNumbers } = useWhatsappPhoneNumbers(accountId)
  const currentAccount = accounts?.find((a) => a.id === accountId)
  const workspaceName =
    phoneNumbers?.find((n) => n.status === "registered" && n.verifiedName)?.verifiedName ||
    currentAccount?.name ||
    "Your workspace"
  const memberRole =
    currentAccount?.role && currentAccount.role !== "owner" ? currentAccount.role : null

  // Inbox badge. Server-computed for the signed-in user rather than summed from
  // the conversation list: the count has to respect this member's conversation
  // scope, and a restricted agent must not carry a badge for threads they can't
  // open. Refreshed on the chat socket so a new message moves it without a
  // route change; marking a thread read invalidates the same key.
  const queryClient = useQueryClient()
  const { data: unread } = useUnreadTotal(accountId)
  const unreadMessages = unread?.total ?? 0
  // Mounted here because the sidebar is on every dashboard route and already
  // holds the shared socket: the tone has to follow you around the product, not
  // only sound while the inbox is open.
  const { notifyFromSocketEvent } = useNotificationSound()
  // Same frame feeds both: the tone always, and a system notification only
  // while the tab is in the background.
  const { notifyFromSocketMessage } = useDesktopNotifications()
  usePushResync()
  useChatSocket(
    accountId,
    useCallback(
      (msg) => {
        if (msg.type === "message") {
          queryClient.invalidateQueries({ queryKey: queryKeys.unreadTotal(accountId ?? "") })
          notifyFromSocketEvent(msg.event?.direction)
          notifyFromSocketMessage(msg.event?.direction, msg.conversation)
        }
      },
      [queryClient, accountId, notifyFromSocketEvent, notifyFromSocketMessage],
    ),
  )

  const counts: Record<BadgeKey, number> = { unread: unreadMessages, alerts: alertCount }

  // Start the destination's first request on hover/focus. Next prefetches the
  // route's code already; this covers the half a first navigation still spent
  // waiting on data after the page mounts.
  const prefetchNav = useNavPrefetch(accountId)

  // Hide what this role can't open. Nothing is hidden until the role is
  // known, so an owner — the usual case — never watches items pop in.
  const visible = (item: NavItem) => !role || canOpen(role, item.href)

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname?.startsWith(`${item.href}/`)

  const handleSignOut = async () => {
    await logout()
    window.location.href = "/login"
  }

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  const renderItem = (item: NavItem) => {
    const active = isActive(item)
    const count = item.badge ? counts[item.badge] : 0

    const link = (
      <Link
        href={item.href}
        className="relative flex w-full items-center gap-3"
        onMouseEnter={() => prefetchNav(item.href)}
        onFocus={() => prefetchNav(item.href)}
        onTouchStart={() => prefetchNav(item.href)}
      >
        <item.icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors duration-fast ease-out-soft",
            active ? "text-sidebar-primary" : "text-sidebar-muted-foreground",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {item.badge ? <NavCount value={count} collapsed={collapsed} /> : null}
      </Link>
    )

    const button = (
      <SidebarMenuButton
        asChild
        isActive={active}
        className={cn(
          "sidebar-item h-9 px-2.5 text-sm font-normal text-sidebar-foreground/90",
          "data-[active=true]:bg-transparent",
          active && "active",
          collapsed && "justify-center px-0",
        )}
      >
        {link}
      </SidebarMenuButton>
    )

    return (
      <SidebarMenuItem key={item.href}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="flex flex-col gap-0.5">
              <span className="font-medium">{item.label}</span>
              {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
            </TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon" className="sidebar-gradient border-r-0">
      <SidebarHeader className="gap-0 p-3">
        <Link
          href="/dashboard"
          title={workspaceName}
          className={cn(
            "focus-ring flex min-w-0 items-center gap-2.5 rounded-md p-1.5",
            collapsed && "justify-center",
          )}
        >
          <span className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary-foreground shadow-sm">
            <MessageSquare className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold tracking-tight text-sidebar-foreground">
                {workspaceName}
              </span>
              {memberRole && (
                <span className="block text-[0.6875rem] capitalize text-sidebar-muted-foreground">
                  Team · {memberRole}
                </span>
              )}
            </span>
          )}
        </Link>

        {!collapsed && (
          <div className="mt-3">
            <SidebarWalletStrip />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <ScrollArea className="h-full custom-scrollbar">
          <div className={cn("space-y-5 pb-4", collapsed && "space-y-3")}>
            {NAV.filter((group) => group.items.some(visible)).map((group) => (
              <div key={group.label}>
                {collapsed ? (
                  <div className="section-divider" />
                ) : (
                  <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-label text-sidebar-muted-foreground/80">
                    {group.label}
                  </p>
                )}
                <SidebarMenu className="gap-0.5">{group.items.filter(visible).map(renderItem)}</SidebarMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <SidebarMenu className="gap-0.5">
          {FOOTER.map(renderItem)}

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className={cn(
                "sidebar-item h-9 px-2.5 text-sm font-normal text-sidebar-foreground/80",
                "hover:bg-destructive-soft hover:text-destructive",
                collapsed && "justify-center px-0",
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {!collapsed && user && (
          <div className="mt-2 flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar className="h-8 w-8 avatar-glow">
              <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {user.name && (
                <p className="truncate text-xs font-medium text-sidebar-foreground">{user.name}</p>
              )}
              <p className="truncate text-[11px] text-sidebar-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
