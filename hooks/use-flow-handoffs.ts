"use client"

import { useCallback, useEffect, useState } from "react"
import { useChatSocket, type ChatSocketMessage } from "@/hooks/use-chat-socket"

export interface FlowHandoff {
  conversationId: string
  flowName: string
  variables: Record<string, string>
  at: Date
}

// Session-scoped store shared by the chat sidebar and the open thread, so a
// handoff received while looking at another page still badges the list.
const handoffs = new Map<string, FlowHandoff>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((cb) => cb())
}

export function useFlowHandoffs(accountId: string | null) {
  const [, setVersion] = useState(0)

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const handleSocketMessage = useCallback((msg: ChatSocketMessage) => {
    if (msg.type !== "flow_handoff") return
    const conversationId = msg.conversation?.id || msg.conversationId
    if (!conversationId) return
    handoffs.set(conversationId, {
      conversationId,
      flowName: msg.flowName || "chatbot",
      variables: msg.variables || {},
      at: new Date(),
    })
    notify()
  }, [])

  useChatSocket(accountId, handleSocketMessage)

  const dismiss = useCallback((conversationId: string) => {
    if (handoffs.delete(conversationId)) notify()
  }, [])

  return {
    handoffFor: (conversationId: string) => handoffs.get(conversationId),
    hasHandoff: (conversationId: string) => handoffs.has(conversationId),
    dismiss,
  }
}
