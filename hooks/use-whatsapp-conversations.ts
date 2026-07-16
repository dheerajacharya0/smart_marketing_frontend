"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getAvailableWhatsappContexts,
  setActiveWhatsappPhoneNumberId,
  getChatConversations,
  type WhatsappContext,
  type ConversationFilters,
} from "@/services/api"
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

function mapConversation(raw: any): Conversation {
  return {
    id: raw.id,
    wabaId: raw.wabaId,
    phoneNumberId: raw.phoneNumberId,
    contactWaId: raw.contactWaId,
    name: raw.contactName || raw.contactWaId,
    lastMessage: raw.lastMessagePreview || "",
    lastMessageAt: new Date(raw.lastMessageAt),
    unreadCount: raw.unreadCount || 0,
    assigneeId: raw.assigneeId ?? null,
    assigneeName: raw.assigneeName ?? null,
    labels: Array.isArray(raw.labels) ? raw.labels : [],
  }
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
        getActiveWhatsappContext(user.id),
        getAvailableWhatsappContexts(user.id),
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

  const switchContext = useCallback(
    async (phoneNumberId: string) => {
      const next = availableContexts.find((c) => c.phoneNumberId === phoneNumberId)
      if (!next) return
      setActiveWhatsappPhoneNumberId(next.phoneNumberId)
      setContext(next)
      contextRef.current = next
      setLoading(true)
      try {
        await loadConversationsFor(next)
      } finally {
        setLoading(false)
      }
    },
    [availableContexts, loadConversationsFor]
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
