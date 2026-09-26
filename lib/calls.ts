import type { WhatsappCall } from "@/services/api"

/**
 * Calls ringing on this dashboard, newest first, given the current list and one
 * update off the socket. Pure, so the ringing rules are testable without a
 * browser: a call is shown while it is `ringing`, and dropped the moment any
 * update says otherwise — including someone else answering it.
 */
export function applyCallUpdate(
  ringing: readonly WhatsappCall[],
  update: WhatsappCall,
): WhatsappCall[] {
  const others = ringing.filter((c) => c.id !== update.id)
  if (update.status !== "ringing") return others
  return [update, ...others]
}

/** "1:05", "12:40", "1:02:03" — for the in-call timer and the call log. */
export function formatCallDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** Display name for the caller: their WhatsApp name, else the number. */
export function callerLabel(call: Pick<WhatsappCall, "customerName" | "customerWaId">): string {
  return call.customerName?.trim() || `+${call.customerWaId}`
}
