"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Plus, UserCircle, MessagesSquare, PlugZap, SearchX } from "lucide-react"
import { useWhatsappConversations } from "@/hooks/use-whatsapp-conversations"
import { useFlowHandoffs } from "@/hooks/use-flow-handoffs"
import { useTeamMembers } from "@/hooks/use-team-members"
import { WhatsappAccountSwitcher } from "@/components/whatsapp-account-switcher"
import { Badge } from "@/components/ui/badge"
import { displayLabel, initials } from "@/lib/team-display"
import { cn } from "@/lib/utils"
import type { ConversationFilters } from "@/services/api"

function formatLastSeen(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

// Assignment filter encoded as one select value.
const ALL = "all"
const MINE = "me"
const UNASSIGNED = "unassigned"

export function ChatSidebar() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const { conversations, loading, context, availableContexts, switchContext, filters, setFilters } =
    useWhatsappConversations()
  const { hasHandoff } = useFlowHandoffs(context?.accountId ?? null)
  const { assignees, currentUserId } = useTeamMembers(context?.accountId ?? null)

  // Known labels for the label filter — collected from loaded rows, plus the
  // active one so it never disappears while selected.
  const knownLabels = useMemo(() => {
    const set = new Set<string>()
    conversations.forEach((c) => c.labels.forEach((l) => set.add(l)))
    if (filters.label) set.add(filters.label)
    return [...set].sort()
  }, [conversations, filters.label])

  // Current assignment-select value derived from filters
  const assignmentValue = filters.unassigned
    ? UNASSIGNED
    : filters.assigneeId
      ? filters.assigneeId === currentUserId
        ? MINE
        : filters.assigneeId
      : ALL

  const setAssignment = (value: string) => {
    const next: ConversationFilters = { label: filters.label }
    if (value === UNASSIGNED) next.unassigned = true
    else if (value === MINE) next.assigneeId = currentUserId ?? undefined
    else if (value !== ALL) next.assigneeId = value
    setFilters(next)
  }

  const setLabelFilter = (value: string) => {
    setFilters({ ...filters, label: value === ALL ? undefined : value })
  }

  // Handed-off conversations need a human — surface them first.
  const filteredChats = conversations
    .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => Number(hasHandoff(b.id)) - Number(hasHandoff(a.id)))

  const hasFilters = !!searchQuery || !!filters.label || !!filters.assigneeId || !!filters.unassigned

  return (
    <div className="flex h-full w-full flex-col border-r border-border-subtle bg-card lg:w-80 xl:w-96">
      {/* Search + filters */}
      <div className="space-y-2 border-b border-border-subtle p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <WhatsappAccountSwitcher
          context={context}
          availableContexts={availableContexts}
          onSwitch={switchContext}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={assignmentValue} onValueChange={setAssignment}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All conversations</SelectItem>
              <SelectItem value={MINE}>Assigned to me</SelectItem>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {assignees.length > 0 && <SelectSeparator />}
              {assignees
                .filter((a) => a.userId !== currentUserId)
                .map((a) => (
                  <SelectItem key={a.userId} value={a.userId}>
                    {a.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={filters.label ?? ALL} onValueChange={setLabelFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All labels</SelectItem>
              {knownLabels.map((l) => (
                <SelectItem key={l} value={l}>
                  {displayLabel(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full max-w-44" />
                </div>
              </div>
            ))
          ) : !context ? (
            <EmptyState
              plain
              icon={PlugZap}
              title="No account connected"
              description="Link a WhatsApp Business account to start receiving messages."
              className="px-4 py-10"
            />
          ) : filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const active = pathname === `/dashboard/chat/${chat.id}`
              return (
                <Link
                  key={chat.id}
                  href={`/dashboard/chat/${chat.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-start gap-3 rounded-lg p-3 transition-colors duration-fast ease-out-soft",
                    active ? "bg-sidebar-accent" : "hover:bg-accent/60",
                  )}
                >
                  {/* Lit edge on the open thread — a filled row plus an accent
                      rail, so the selection survives a busy list. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                    />
                  )}
                  <Avatar className="mt-0.5 h-10 w-10 shrink-0 border border-whatsapp/20">
                    <AvatarFallback className="bg-whatsapp/10 text-xs text-whatsapp">
                      {chat.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3
                        className={cn(
                          "truncate text-sm",
                          chat.unreadCount > 0 ? "font-semibold" : "font-medium",
                        )}
                      >
                        {chat.name}
                      </h3>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatLastSeen(chat.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          chat.unreadCount > 0 ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {chat.lastMessage}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-whatsapp px-1.5 text-[11px] font-medium tabular-nums text-white">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {hasHandoff(chat.id) && (
                        <Badge className="bg-warning-soft px-1.5 text-[10px] text-warning hover:bg-warning-soft">
                          needs attention
                        </Badge>
                      )}
                      {chat.assigneeId ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-medium text-primary">
                            {initials(chat.assigneeName || "?")}
                          </span>
                          {chat.assigneeName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <UserCircle className="h-3.5 w-3.5" /> Unassigned
                        </span>
                      )}
                      {chat.labels.map((label) => (
                        <Badge key={label} variant="outline" className="px-1.5 py-0 text-[10px]">
                          {displayLabel(label)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Link>
              )
            })
          ) : hasFilters ? (
            <EmptyState
              plain
              icon={SearchX}
              title="No conversations match"
              description="Try a different search, or clear the assignment and label filters."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setFilters({})
                  }}
                >
                  Clear filters
                </Button>
              }
              className="px-4 py-10"
            />
          ) : (
            <EmptyState
              plain
              icon={MessagesSquare}
              title="No conversations yet"
              description="A thread appears here the moment someone messages your WhatsApp number."
              className="px-4 py-10"
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border-subtle p-3">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/dashboard/chat/new">
            <Plus className="mr-2 h-4 w-4" />
            New conversation
          </Link>
        </Button>
      </div>
    </div>
  )
}
