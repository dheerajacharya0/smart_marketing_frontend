"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getAvailableWhatsappContexts,

  getChatConversations,
  type WhatsappContext,
  type ConversationFilters,
} from "@/services/api"
import { useActiveNumber } from "@/hooks/use-active-number"
import { useChatSocket, type ChatSocketMessage } from "@/hooks/use-chat-socket"

export interface Conversation {
  id: string
  wabaId: string
  phoneNumberId: string
  contactWaId: string
  name: string
  lastMessage: string
  lastMessageAt: Date
  unreadCount: number
  assigneeId: string | null
  assigneeName: string | null
  labels: string[]
}

/**
 * The conversation row as the API list and the socket both send it. Named so
 * the mapper and the update subscriber below share one shape instead of each
 * taking `any`.
 */
export interface RawConversation {
  id: string
  wabaId: string
  phoneNumberId: string
  contactWaId: string
  contactName?: string | null
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  unreadCount?: number | null
  assigneeId?: string | null
  assigneeName?: string | null
  labels?: string[] | null
}

function mapConversation(raw: RawConversation): Conversation {
  return {
    id: raw.id,
    wabaId: raw.wabaId,
    phoneNumberId: raw.phoneNumberId,
    contactWaId: raw.contactWaId,
    name: raw.contactName || raw.contactWaId,
    lastMessage: raw.lastMessagePreview || "",
    // A row with no timestamp sorts to the bottom rather than becoming an
    // Invalid Date that breaks every comparison it touches.
    lastMessageAt: raw.lastMessageAt ? new Date(raw.lastMessageAt) : new Date(0),
    unreadCount: raw.unreadCount || 0,
    assigneeId: raw.assigneeId ?? null,
    assigneeName: raw.assigneeName ?? null,
    labels: Array.isArray(raw.labels) ? raw.labels : [],
  }
}

/**
 * Conversation-row updates that don't come from the socket.
 *
 * The inbox mounts this hook twice — once in the conversation list, once in
 * the open thread — and each instance keeps its own state, so there is no
 * shared cache one can write to for the other to notice. This is that shared
 * point: publish once, every mounted instance patches the row it holds.
 */
type ConversationSubscriber = (raw: RawConversation) => void
const conversationSubscribers = new Set<ConversationSubscriber>()

export function publishConversationUpdate(raw: RawConversation) {
  if (!raw?.id) return
  conversationSubscribers.forEach((fn) => fn(raw))
}

/**
 * The thread currently on screen, and the rows known to be read.
 *
 * The unread badge is cleared here rather than from whatever the mark-read
 * response happens to contain. Two reasons. The response shape is the
 * server's business and an envelope change would silently stop the badge
 * clearing again. And more importantly the badge is a statement about the
 * person looking at the screen: they have the thread open, so for them it is
 * read, and that is true before any request comes back.
 *
 * Keeping the open id also stops a socket update from putting the badge back
 * — a `message` event carries the row as the server sees it, and the server
 * does not know this user is staring at that thread right now.
 */
type ReadSubscriber = (conversationId: string) => void
const readSubscribers = new Set<ReadSubscriber>()
let openConversationId: string | null = null

export function setOpenConversation(conversationId: string | null) {
  openConversationId = conversationId
  if (conversationId) readSubscribers.forEach((fn) => fn(conversationId))
}

// Does a conversation still belong in the list under the active filter? Used
// to drop rows when a WS update pushes them out of the current filter (e.g. a
// conversation gets assigned while "Unassigned" is selected).
function matchesFilter(c: Conversation, filters: ConversationFilters): boolean {
  if (filters.unassigned) return c.assigneeId == null
  if (filters.assigneeId && c.assigneeId !== filters.assigneeId) return false
  if (filters.label && !c.labels.includes(filters.label.toLowerCase())) return false
  return true
}

export function useWhatsappConversations() {
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [availableContexts, setAvailableContexts] = useState<WhatsappContext[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFiltersState] = useState<ConversationFilters>({})
  const contextRef = useRef<WhatsappContext | null>(null)
  const filtersRef = useRef<ConversationFilters>({})

  const loadConversationsFor = useCallback(async (ctx: WhatsappContext | null) => {
    if (!ctx) {
      setConversations([])
      return []
    }
    const res: any = await getChatConversations(ctx.accountId, filtersRef.current)
    const list = Array.isArray(res) ? res : res?.data
    const mapped = (Array.isArray(list) ? list : [])
      .map(mapConversation)
      .filter((c) => c.phoneNumberId === ctx.phoneNumberId)
      // Same rule as the socket path: a refetch shouldn't bring the badge
      // back on the thread the user is reading.
      .map((c) => (c.id === openConversationId ? { ...c, unreadCount: 0 } : c))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    setConversations(mapped)
    return mapped
  }, [])

  const setFilters = useCallback(
    (next: ConversationFilters) => {
      filtersRef.current = next
      setFiltersState(next)
      setLoading(true)
      loadConversationsFor(contextRef.current).finally(() => setLoading(false))
    },
    [loadConversationsFor]
  )

  // Re-fetches just the conversation list for the current context (cheap poll,
  // skips re-resolving the account/context like the full refetch() below does).
  const refetchConversations = useCallback(() => {
    return loadConversationsFor(contextRef.current)
  }, [loadConversationsFor])

  const refetch = useCallback(async () => {
    const user = getUserDataFromCookie()
    if (!user?.id) {
      setLoading(false)
      return
    }
    try {
      const [ctx, all] = await Promise.all([
        getActiveWhatsappContext(),
        getAvailableWhatsappContexts(),
      ])
      setContext(ctx)
      contextRef.current = ctx
      setAvailableContexts(all)
      await loadConversationsFor(ctx)
    } catch (err) {
      console.error("Failed to load WhatsApp conversations:", err)
    } finally {
      setLoading(false)
    }
  }, [loadConversationsFor])

  // The inbox's own number picker is the global switch: switching here
  // moves the whole dashboard (and re-mounts this page on the new number),
  // so the inbox can never show one number while campaigns send from another.
  const { switchNumber } = useActiveNumber()
  const switchContext = useCallback(
    async (phoneNumberId: string) => {
      if (!availableContexts.some((c) => c.phoneNumberId === phoneNumberId)) return
      switchNumber(phoneNumberId)
    },
    [availableContexts, switchNumber]
  )

  useEffect(() => {
    refetch()
  }, [refetch])

  // Realtime updates over the WS: every 'message'/'status' event carries the
  // updated Conversation row — patch it in place instead of refetching the list.
  const handleSocketMessage = useCallback((msg: ChatSocketMessage) => {
    if (msg.type !== "message" && msg.type !== "status") return
    if (contextRef.current && msg.conversation.phoneNumberId !== contextRef.current.phoneNumberId) return
    const updated = mapConversation(msg.conversation)
    // Being read wins over the server's count for the open thread.
    if (updated.id === openConversationId) updated.unreadCount = 0
    setConversations((prev) => {
      // If an assignee/label change pushes this row out of the active filter,
      // drop it; otherwise upsert and re-sort.
      if (!matchesFilter(updated, filtersRef.current)) {
        return prev.filter((c) => c.id !== updated.id)
      }
      const next = prev.some((c) => c.id === updated.id)
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : [updated, ...prev]
      return next.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    })
  }, [])

  // Row updates published from elsewhere in the inbox (see above).
  useEffect(() => {
    const apply = (raw: RawConversation) => {
      const updated = mapConversation(raw)
      if (contextRef.current && updated.phoneNumberId !== contextRef.current.phoneNumberId) return
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      )
    }
    conversationSubscribers.add(apply)
    return () => {
      conversationSubscribers.delete(apply)
    }
  }, [])

  // A thread being opened clears its badge here and now.
  useEffect(() => {
    const markRead = (conversationId: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      )
    }
    readSubscribers.add(markRead)
    // A list that mounts while a thread is already open (navigating back to
    // the inbox on a phone) starts with that row already cleared.
    if (openConversationId) markRead(openConversationId)
    return () => {
      readSubscribers.delete(markRead)
    }
  }, [])

  // Events during a disconnect aren't replayed server-side — re-fetch on reconnect.
  const handleReconnect = useCallback(() => {
    loadConversationsFor(contextRef.current)
  }, [loadConversationsFor])

  useChatSocket(context?.accountId ?? null, handleSocketMessage, handleReconnect)

  return {
    context,
    availableContexts,
    conversations,
    loading,
    filters,
    setFilters,
    refetch,
    refetchConversations,
    switchContext,
  }
}
