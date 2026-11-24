import { describe, expect, it } from "vitest"
import { mapChatEvents } from "@/hooks/use-chat-messages"

const row = (over: Record<string, unknown>) => ({
  id: "e1",
  direction: "outbound",
  waMessageId: "wamid.1",
  receivedAt: "2026-11-24T10:00:00Z",
  payload: { type: "text", text: { body: "hi" } },
  status: null,
  ...over,
})

describe("mapChatEvents: delivery state", () => {
  it("shows a message sent from the WhatsApp Business app as sent, not Sending…", () => {
    const [m] = mapChatEvents([row({ source: "business_app" })])
    expect(m.status).toBe("sent")
  })

  it("keeps a stored status on a Business app message", () => {
    const [m] = mapChatEvents([row({ source: "business_app", status: "read" })])
    expect(m.status).toBe("read")
  })

  it("still lets a status row upgrade an old Business app message", () => {
    const [m] = mapChatEvents([
      row({ source: "business_app" }),
      { id: "s1", direction: "status", waMessageId: "wamid.1", status: "delivered", receivedAt: "2026-11-24T10:00:01Z" },
    ])
    expect(m.status).toBe("delivered")
  })

  it("leaves our own in-flight sends without a status", () => {
    const [m] = mapChatEvents([row({ source: "manual" })])
    expect(m.status).toBeFalsy()
  })

  it("never gives an inbound message a delivery state", () => {
    const [m] = mapChatEvents([row({ direction: "inbound", source: "business_app", from: "9198" })])
    expect(m.status).toBeFalsy()
  })
})
