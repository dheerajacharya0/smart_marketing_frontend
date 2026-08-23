"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getChatMessages, markChatConversationRead } from "@/services/api"
import {
  publishConversationUpdate,
  setOpenConversation,
} from "@/hooks/use-whatsapp-conversations"
import { getErrorMessage } from "@/lib/errors"
import { failureFromPayload, mergeStatus } from "@/lib/message-status"
import { toast } from "react-hot-toast"
import { useChatSocket, type ChatSocketMessage } from "@/hooks/use-chat-socket"
import { queryKeys } from "@/hooks/use-queries"

const PAGE_SIZE = 50

/**
 * Marking a thread read is a write whose only visible effect is a badge
 * disappearing — so when it fails, nothing looks wrong. It just quietly
 * doesn't stick, and the badge is back on the next visit with no clue why.
 *
 * Say so once per session: enough for the user to know the read state isn't
 * being saved, without a toast every time they open a conversation.
 */
let reportedReadFailure = false

function reportReadFailure(err: unknown) {
  const detail = getErrorMessage(err) || "Unknown error"
  console.error("Failed to mark conversation read:", err)
  if (reportedReadFailure) return
  reportedReadFailure = true
  toast.error(`Couldn't save your read position — ${detail}. Unread counts may come back.`)
}

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
  // The specific half of the failure. `errorTitle` is often generic
  // ("Message undeliverable"); this is the sentence worth showing when Meta
  // sends one. See `failureReason` in lib/message-status.ts.
  errorDetails?: string | null
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

/**
 * Inbound message types that are not text and not media. Cloud API delivers
 * all of these and we were rendering every one of them as a bare `[type]`
 * tag — or, for anything Meta itself couldn't represent, as a flat
 * "unsupported" line that told the reader nothing about what they had been
 * sent.
 */
function extractOtherInbound(payload: any): string | undefined {
  // A location share. The name/address are optional; the coordinates are not.
  if (payload?.location) {
    const { name, address, latitude, longitude } = payload.location
    const place = name || address
    return place ? `📍 ${place}` : `📍 Location (${latitude}, ${longitude})`
  }

  // A shared contact card — one or several.
  if (Array.isArray(payload?.contacts) && payload.contacts.length > 0) {
    const first = payload.contacts[0]?.name?.formatted_name
    const rest = payload.contacts.length - 1
    const who = first || "a contact"
    return rest > 0 ? `👤 Shared ${who} and ${rest} more` : `👤 Shared ${who}`
  }

  // A reaction to an earlier message. An empty emoji means the reaction was
  // removed, which is a real event and not an error.
  if (payload?.reaction) {
    return payload.reaction.emoji
      ? `Reacted ${payload.reaction.emoji}`
      : "Removed their reaction"
  }

  // Order / product enquiry from a catalogue.
  if (payload?.order) {
    const count = Array.isArray(payload.order.product_items)
      ? payload.order.product_items.length
      : 0
    return count > 0 ? `🛒 Sent an order of ${count} item${count === 1 ? "" : "s"}` : "🛒 Sent an order"
  }

  // System notices: the contact changed their number, or their display name.
  if (payload?.system?.body) return payload.system.body

  return undefined
}

/**
 * Meta's own "we can't represent this" marker. It arrives with an `errors`
 * array explaining why, and that reason is the only useful thing in the
 * payload — the message body genuinely never reaches us. Surfacing Meta's
 * wording beats a flat line that leaves the reader guessing whether the
 * problem is on their side or ours.
 */
function unsupportedReason(payload: any): string {
  const error = Array.isArray(payload?.errors) ? payload.errors[0] : undefined
  const detail = error?.error_data?.details || error?.title
  return detail
    ? `Message not supported by WhatsApp Business — ${String(detail).toLowerCase()}`
    : "Message not supported by WhatsApp Business — its contents never reach us. Ask the contact to resend it as text, a photo, or a file."
}

function extractInboundContent(payload: any): string {
  if (payload?.text?.body) return payload.text.body
  const menuReply = extractMenuReply(payload)
  if (menuReply) return menuReply
  const media = extractMedia(payload)
  if (media) return media.caption || media.filename || `[${media.type}]`
  const other = extractOtherInbound(payload)
  if (other) return other
  if (payload?.type === "unsupported") return unsupportedReason(payload)
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
    errorDetails: e.errorDetails ?? undefined,
    waMessageId: e.waMessageId,
    templateName: !inbound ? e.payload?.template?.name : undefined,
    templateLanguage: !inbound ? e.payload?.template?.language?.code : undefined,
    templateParams: !inbound ? extractOutboundTemplateParams(e.payload) : undefined,
    media: extractMedia(e.payload),
    interactive: !inbound ? extractInteractive(e.payload) : undefined,
    isMenuReply: inbound ? !!extractMenuReply(e.payload) : undefined,
  }
}

// What the status rows for one outbound message add up to. Meta redelivers
// webhooks and they arrive out of order, so the rows are folded together by
// rank (see lib/message-status.ts) rather than last-write-wins — otherwise a
// late `delivered` un-reads a message that was already read.
interface StatusRollup {
  status?: string
  errorCode?: number | null
  errorTitle?: string | null
  errorDetails?: string | null
}

function foldStatusRow(current: StatusRollup | undefined, row: any): StatusRollup {
  const merged = mergeStatus(current?.status, row.status)
  // Status rows carry the reason in Meta's `errors[]` rather than in columns —
  // the backend mirrors those onto the outbound row instead. Read both.
  const failure = failureFromPayload(row.payload)
  return {
    status: merged,
    // Failure detail only ever comes from the row that reported the failure,
    // so keep whatever we have rather than letting a later row blank it.
    errorCode: row.errorCode ?? failure.code ?? current?.errorCode,
    errorTitle: row.errorTitle ?? failure.title ?? current?.errorTitle,
    errorDetails: row.errorDetails ?? failure.details ?? current?.errorDetails,
  }
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
  const rollupByWaMessageId = new Map<string, StatusRollup>()
  for (const e of events) {
    if (e.direction === "status" && e.waMessageId) {
      rollupByWaMessageId.set(e.waMessageId, foldStatusRow(rollupByWaMessageId.get(e.waMessageId), e))
    }
  }

  return events
    .filter((e) => e.direction === "inbound" || e.direction === "outbound")
    .map((e) => {
      const mapped = mapSingleEvent(e)
      const rollup = e.waMessageId ? rollupByWaMessageId.get(e.waMessageId) : undefined
      if (!rollup) return mapped
      return {
        ...mapped,
        status: mergeStatus(mapped.status, rollup.status),
        errorCode: mapped.errorCode ?? rollup.errorCode ?? undefined,
        errorTitle: mapped.errorTitle ?? rollup.errorTitle ?? undefined,
        errorDetails: mapped.errorDetails ?? rollup.errorDetails ?? undefined,
      }
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export function useChatMessages(conversationId: string | null, accountId: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const oldestLoadedRef = useRef<string | null>(null)
  const queryClient = useQueryClient()

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

  // Advance this user's read cursor as soon as the thread is opened. The cursor
  // is per (conversation, user), so this clears the badge for the person reading
  // and nobody else — then invalidate the sidebar total, which the server
  // computes and can't know to recount on its own.
  useEffect(() => {
    if (!conversationId || !accountId) return

    // Clear the badge immediately. The thread is open; for this reader it is
    // read, whatever the request does next. This also registers the open
    // thread so a later socket event or refetch can't put the badge back.
    setOpenConversation(conversationId)

    markChatConversationRead(conversationId, accountId)
      .then((conversation) => {
        // If the response carries the updated row, fold it in for the rest
        // of its fields — but the badge above does not depend on it.
        if (conversation?.id) publishConversationUpdate(conversation)
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadTotal(accountId) })
      })
      .catch(reportReadFailure)

    return () => setOpenConversation(null)
  }, [conversationId, accountId, queryClient])

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
      fresh.forEach((m) => {
        const existing = byId.get(m.id)
        // A socket status can be ahead of what this fetch returns, so the
        // refetched row must not walk the bubble back down the progression.
        byId.set(
          m.id,
          existing
            ? {
                ...m,
                status: mergeStatus(existing.status, m.status),
                errorCode: m.errorCode ?? existing.errorCode,
                errorTitle: m.errorTitle ?? existing.errorTitle,
                errorDetails: m.errorDetails ?? existing.errorDetails,
              }
            : m
        )
      })
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
        // The socket delivers the *status* row, and the backend mirrors the
        // error columns onto the *outbound* row in a separate UPDATE — so
        // errorCode/Title/Details are null here and Meta's `errors[]` inside
        // the payload is the only copy of the reason we get in realtime.
        const failure = failureFromPayload(event.payload)
        setMessages((prev) =>
          prev.map((m) =>
            m.waMessageId === event.waMessageId
              ? {
                  ...m,
                  // Rank-ordered: a redelivered `delivered` arriving after a
                  // `read` is dropped, and nothing outranks `failed`.
                  status: mergeStatus(m.status, event.status),
                  errorCode: event.errorCode ?? failure.code ?? m.errorCode,
                  errorTitle: event.errorTitle ?? failure.title ?? m.errorTitle,
                  errorDetails: event.errorDetails ?? failure.details ?? m.errorDetails,
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
      // A message arriving on the thread you're looking at is already read, so
      // advance the cursor rather than letting the badge tick up and back down.
      if (event.direction === "inbound" && conversationId && accountId) {
        setOpenConversation(conversationId)
        markChatConversationRead(conversationId, accountId)
          .then((conversation) => {
            if (conversation?.id) publishConversationUpdate(conversation)
            queryClient.invalidateQueries({ queryKey: queryKeys.unreadTotal(accountId) })
          })
          .catch(reportReadFailure)
      }
    },
    [conversationId, accountId, queryClient]
  )

  // Events during a disconnect aren't replayed server-side — re-fetch on reconnect.
  const handleReconnect = useCallback(() => {
    mergeLatest()
  }, [mergeLatest])

  useChatSocket(accountId, handleSocketMessage, handleReconnect)

  return { messages, loading, loadingOlder, hasMore, loadOlder, refetch: loadLatest }
}
