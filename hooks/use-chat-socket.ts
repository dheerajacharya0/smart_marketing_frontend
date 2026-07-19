"use client"

import { useEffect, useRef } from "react"
import { isAuthenticated } from "@/services/api"
import { CHAT_WS_URL } from "@/config/api-config"

export type ChatSocketMessage =
  | { type: "message"; conversation: any; event: any }
  | { type: "status"; conversation: any; event: any }
  | {
      type: "flow_handoff"
      conversation?: any
      conversationId?: string
      phoneNumberId?: string
      flowId?: string
      flowName?: string
      variables?: Record<string, string>
    }

type MessageListener = (msg: ChatSocketMessage) => void
type ReconnectListener = () => void

interface SocketEntry {
  socket: WebSocket | null
  listeners: Set<MessageListener>
  reconnectListeners: Set<ReconnectListener>
  reconnectAttempt: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  hasConnectedOnce: boolean
  closedIntentionally: boolean
}

const registry = new Map<string, SocketEntry>()

function getEntry(accountId: string): SocketEntry {
  let entry = registry.get(accountId)
  if (!entry) {
    entry = {
      socket: null,
      listeners: new Set(),
      reconnectListeners: new Set(),
      reconnectAttempt: 0,
      reconnectTimer: null,
      hasConnectedOnce: false,
      closedIntentionally: false,
    }
    registry.set(accountId, entry)
  }
  return entry
}

function connect(accountId: string) {
  const entry = getEntry(accountId)
  if (entry.socket) return
  // The JWT rides as the httpOnly access_token cookie, sent automatically on the
  // same-site WS handshake — JS never sees it. Gate on session presence instead.
  if (!isAuthenticated()) return

  entry.closedIntentionally = false
  const ws = new WebSocket(CHAT_WS_URL(accountId))
  entry.socket = ws

  ws.onopen = () => {
    entry.reconnectAttempt = 0
    if (entry.hasConnectedOnce) {
      entry.reconnectListeners.forEach((cb) => cb())
    }
    entry.hasConnectedOnce = true
  }

  ws.onmessage = (evt) => {
    let parsed: ChatSocketMessage
    try {
      parsed = JSON.parse(evt.data)
    } catch {
      return
    }
    entry.listeners.forEach((listener) => listener(parsed))
  }

  ws.onclose = () => {
    entry.socket = null
    // Bad token / accountId not owned by this user -> refused outright, no
    // open event fires. Don't hammer it in a tight loop either way; back off.
    if (entry.closedIntentionally || entry.listeners.size === 0) return
    const delay = Math.min(30000, 1000 * 2 ** entry.reconnectAttempt)
    entry.reconnectAttempt += 1
    entry.reconnectTimer = setTimeout(() => connect(accountId), delay)
  }
}

function disconnect(accountId: string) {
  const entry = registry.get(accountId)
  if (!entry) return
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer)
  entry.closedIntentionally = true
  entry.socket?.close()
  entry.socket = null
  registry.delete(accountId)
}

// Shares one WebSocket per accountId across every caller (sidebar + open
// thread), since the server scopes one connection to one accountId.
export function useChatSocket(
  accountId: string | null,
  onMessage: MessageListener,
  onReconnect?: ReconnectListener
) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    if (!accountId) return
    const entry = getEntry(accountId)
    const messageListener: MessageListener = (msg) => onMessageRef.current(msg)
    const reconnectListener: ReconnectListener = () => onReconnectRef.current?.()
    entry.listeners.add(messageListener)
    entry.reconnectListeners.add(reconnectListener)
    connect(accountId)

    return () => {
      entry.listeners.delete(messageListener)
      entry.reconnectListeners.delete(reconnectListener)
      if (entry.listeners.size === 0) disconnect(accountId)
    }
  }, [accountId])
}
