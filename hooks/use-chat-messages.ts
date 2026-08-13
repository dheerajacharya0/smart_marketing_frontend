"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getChatMessages, markChatConversationRead } from "@/services/api"
import { useChatSocket, type ChatSocketMessage } from "@/hooks/use-chat-socket"

const PAGE_SIZE = 50

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"] as const
export type MessageMediaType = (typeof MEDIA_TYPES)[number]

export interface MessageMedia {
  type: MessageMediaType
  id?: string // Cloud API media id — fetch through the auth download proxy
  link?: string // outbound-by-link — user-supplied public URL, safe to render directly
  caption?: string
  filename?: string
  mimeType?: string
}

export interface MessageInteractive {
  kind: "buttons" | "list"
  bodyText: string
  headerText?: string
  footerText?: string
  buttons?: { id: string; title: string }[]
  buttonText?: string
  sections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[]
}

export interface ConversationMessage {
  id: string
  content: string
  sender: "me" | "them"
  timestamp: Date
  status?: string
  // Final failure detail read straight off the outbound record (no status-row
  // join): Meta error code + human title when status is "failed".
  errorCode?: number | null
  errorTitle?: string | null
  waMessageId?: string | null
  templateName?: string
  templateLanguage?: string
  templateParams?: string[]
  media?: MessageMedia
  interactive?: MessageInteractive
  // Inbound button/list reply — rendered as text with a "replied to menu" note
  isMenuReply?: boolean
}

// Media details live under payload.<type> for both directions (Meta echoes the
// send request shape back on outbound rows).
function extractMedia(payload: any): MessageMedia | undefined {
  for (const type of MEDIA_TYPES) {
    const m = payload?.[type]
    if (!m || typeof m !== "object") continue
    return {
      type,
      id: m.id || undefined,
      link: m.link || undefined,
      caption: m.caption || undefined,
      filename: m.filename || undefined,
      mimeType: m.mime_type || m.mimeType || undefined,
    }
  }
  return undefined
}

// Outbound interactive payloads: Meta request shape (interactive.type,
// body.text, action.*) or our backend input shape (kind, bodyText, ...).
function extractInteractive(payload: any): MessageInteractive | undefined {
  const i = payload?.interactive
  if (i && (i.type === "button" || i.type === "list")) {
    return {
      kind: i.type === "button" ? "buttons" : "list",
      bodyText: i.body?.text || "",
      headerText: i.header?.text || undefined,
      footerText: i.footer?.text || undefined,
      buttons: Array.isArray(i.action?.buttons)
        ? i.action.buttons.map((b: any) => ({ id: b.reply?.id || "", title: b.reply?.title || "" }))
        : undefined,
      buttonText: i.action?.button || undefined,
      sections: Array.isArray(i.action?.sections)
        ? i.action.sections.map((s: any) => ({
            title: s.title || undefined,
            rows: (s.rows || []).map((r: any) => ({
              id: r.id || "",
              title: r.title || "",
              description: r.description || undefined,
            })),
          }))
        : undefined,
    }
  }
  if (payload?.kind === "buttons" || payload?.kind === "list") {
    return {
      kind: payload.kind,
      bodyText: payload.bodyText || "",
      headerText: payload.headerText || undefined,
      footerText: payload.footerText || undefined,
      buttons: payload.buttons,
      buttonText: payload.buttonText || undefined,
      sections: payload.sections,
    }
  }
  return undefined
}

// Inbound reply to an interactive message — the chosen option's title.
function extractMenuReply(payload: any): string | undefined {
  return (
    payload?.interactive?.button_reply?.title ||
    payload?.interactive?.list_reply?.title ||
    payload?.button?.text ||
    undefined
  )
}

function extractInboundContent(payload: any): string {
  if (payload?.text?.body) return payload.text.body
  const menuReply = extractMenuReply(payload)
  if (menuReply) return menuReply
  const media = extractMedia(payload)
  if (media) return media.caption || media.filename || `[${media.type}]`
  // Meta marks a message "unsupported" when the WhatsApp Cloud API can't
  // represent it (polls, view-once, payments, etc.) — the real content never
  // reaches us, so show a plain explainer instead of a raw "[unsupported]".
  if (payload?.type === "unsupported") return "Unsupported message — can't be shown here"
  if (payload?.type) return `[${payload.type}]`
  return "[message]"
}

function extractOutboundContent(payload: any): string {
  if (payload?.body) return payload.body
  if (payload?.text?.body) return payload.text.body
  if (payload?.template?.name) return `[template: ${payload.template.name}]`
  const interactive = extractInteractive(payload)
  if (interactive) return interactive.bodyText || "[interactive]"
  const media = extractMedia(payload)
  if (media) return media.caption || media.filename || `[${media.type}]`
  return "[message]"
}

// Meta's send payload uses lowercase component types ("body"); template
// definitions fetched from the list endpoint use uppercase ("BODY").
function extractOutboundTemplateParams(payload: any): string[] | undefined {
  const bodyComponent = (payload?.template?.components || []).find(
    (c: any) => String(c.type).toUpperCase() === "BODY"
  )
  const params = bodyComponent?.parameters
  if (!Array.isArray(params)) return undefined
  return params.map((p: any) => p.text ?? p.value ?? "")
}

function mapSingleEvent(e: any): ConversationMessage {
  const inbound = e.direction === "inbound"
  return {
    id: e.id,
    content: inbound ? extractInboundContent(e.payload) : extractOutboundContent(e.payload),
    sender: inbound ? ("them" as const) : ("me" as const),
    timestamp: new Date(e.receivedAt),
    status: e.status,
    errorCode: e.errorCode ?? undefined,
    errorTitle: e.errorTitle ?? undefined,
    waMessageId: e.waMessageId,
    templateName: !inbound ? e.payload?.template?.name : undefined,
    templateLanguage: !inbound ? e.payload?.template?.language?.code : undefined,
    templateParams: !inbound ? extractOutboundTemplateParams(e.payload) : undefined,
    media: extractMedia(e.payload),
    interactive: !inbound ? extractInteractive(e.payload) : undefined,
    isMenuReply: inbound ? !!extractMenuReply(e.payload) : undefined,
  }
}

// The outbound record now carries its own final status + errorCode, so failure
// is authoritative from that single row. Status rows still provide the
// delivered/read progression, so fold them in — but never let a stale row
// downgrade a terminal "failed" on the record.
function resolveStatus(recordStatus?: string, rowStatus?: string): string | undefined {
  if (recordStatus === "failed" || rowStatus === "failed") return "failed"
  return rowStatus || recordStatus
}

/**
 * Raw chat events → renderable messages: drops `status` rows, folds their
 * delivered/read progression back into the outbound record they belong to, and
 * sorts oldest-first.
 *
 * Exported so the contact profile timeline reads message history through the
 * same mapping as the inbox — the payload shapes (media under `payload.<type>`,
 * templates, interactive replies, Meta's "unsupported") are fiddly enough that a
 * second implementation would drift.
 */
export function mapChatEvents(events: any[]): ConversationMessage[] {
  const statusByWaMessageId = new Map<string, string>()
  for (const e of events) {
    if (e.direction === "status" && e.waMessageId) {
      statusByWaMessageId.set(e.waMessageId, e.status)
    }
  }

  return events
    .filter((e) => e.direction === "inbound" || e.direction === "outbound")
    .map((e) => {
      const mapped = mapSingleEvent(e)
      const rowStatus = e.waMessageId ? statusByWaMessageId.get(e.waMessageId) : undefined
      return { ...mapped, status: resolveStatus(e.status, rowStatus) }
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export function useChatMessages(conversationId: string | null, accountId: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const oldestLoadedRef = useRef<string | null>(null)

  const loadLatest = useCallback(async () => {
    if (!conversationId || !accountId) {
      setMessages([])
      return
    }
    const res: any = await getChatMessages(conversationId, accountId, undefined, PAGE_SIZE)
    const list: any[] = Array.isArray(res) ? res : []
    oldestLoadedRef.current = list.length ? list[list.length - 1].receivedAt : null
    setHasMore(list.length === PAGE_SIZE)
    setMessages(mapChatEvents(list))
  }, [conversationId, accountId])

  const loadOlder = useCallback(async () => {
    if (!conversationId || !accountId || !oldestLoadedRef.current || loadingOlder) return
    setLoadingOlder(true)
    try {
      const res: any = await getChatMessages(conversationId, accountId, oldestLoadedRef.current, PAGE_SIZE)
      const events = Array.isArray(res) ? res : []
      const list = Array.isArray(events) ? events : []
      if (list.length) {
        oldestLoadedRef.current = list[list.length - 1].receivedAt
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const older = mapChatEvents(list).filter((m) => !seen.has(m.id))
          return [...older, ...prev]
        })
      }
      setHasMore(list.length === PAGE_SIZE)
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, accountId, loadingOlder])

  useEffect(() => {
    setLoading(true)
    loadLatest().finally(() => setLoading(false))
  }, [loadLatest])

  // Reset unread count server-side as soon as the thread is opened.
  useEffect(() => {
    if (!conversationId || !accountId) return
    markChatConversationRead(conversationId, accountId).catch((err) =>
      console.error("Failed to mark conversation read:", err)
    )
  }, [conversationId, accountId])

  // Merges the latest page into whatever's already loaded (incl. older pages
  // pulled in via loadOlder) instead of blowing them away, unlike loadLatest.
  const mergeLatest = useCallback(async () => {
    if (!conversationId || !accountId) return
    const res: any = await getChatMessages(conversationId, accountId, undefined, PAGE_SIZE)
    const events = Array.isArray(res) ? res : []
    const list = Array.isArray(events) ? events : []
    const fresh = mapChatEvents(list)
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      fresh.forEach((m) => byId.set(m.id, m))
      return Array.from(byId.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    })
  }, [conversationId, accountId])

  // Live updates over the WS for the currently-open thread. Other
  // conversations' events are handled by useWhatsappConversations instead.
  const handleSocketMessage = useCallback(
    (msg: ChatSocketMessage) => {
      if (msg.type !== "message" && msg.type !== "status") return
      if (msg.conversation?.id !== conversationId) return
      const event = msg.event
      if (event.direction === "status") {
        if (!event.waMessageId) return
        setMessages((prev) =>
          prev.map((m) =>
            m.waMessageId === event.waMessageId
              ? {
                  ...m,
                  status: resolveStatus(m.status, event.status),
                  errorCode: event.errorCode ?? m.errorCode,
                  errorTitle: event.errorTitle ?? m.errorTitle,
                }
              : m
          )
        )
        return
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.id)) return prev
        return [...prev, mapSingleEvent(event)].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      })
      // A fresh inbound message on the open thread should also zero unread server-side.
      if (event.direction === "inbound" && conversationId && accountId) {
        markChatConversationRead(conversationId, accountId).catch(() => {})
      }
    },
    [conversationId, accountId]
  )

  // Events during a disconnect aren't replayed server-side — re-fetch on reconnect.
  const handleReconnect = useCallback(() => {
    mergeLatest()
  }, [mergeLatest])

  useChatSocket(accountId, handleSocketMessage, handleReconnect)

  return { messages, loading, loadingOlder, hasMore, loadOlder, refetch: loadLatest }
}
