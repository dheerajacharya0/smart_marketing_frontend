/**
 * Meta Embedded Signup reports what the customer picked (WABA + phone number)
 * through a `window.postMessage` from facebook.com, separate from the FB.login
 * callback that carries the `code`. With sessionInfoVersion 3 the payload is:
 *
 *   { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id, waba_id } }
 *
 * Without it the backend can only take the first number Meta lists in the WABA,
 * which on a second signup re-links the old number instead of adding the new one.
 */

export interface EmbeddedSignupSession {
  wabaId?: string
  phoneNumberId?: string
}

const META_ID = /^\d{1,32}$/

/** Only Meta's own pages may post the session. */
export function isFacebookOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      url.protocol === "https:" &&
      (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"))
    )
  } catch {
    return false
  }
}

/**
 * The picked WABA / number from one `message` event, or null when the event is
 * not a finished Embedded Signup from facebook.com. FINISH_ONLY_WABA (WABA
 * created, no number yet) yields only `wabaId`. Ids that are not numeric are
 * dropped rather than forwarded.
 */
export function parseEmbeddedSignupMessage(
  origin: string,
  raw: unknown
): EmbeddedSignupSession | null {
  if (!isFacebookOrigin(origin)) return null
  let message: unknown = raw
  if (typeof raw === "string") {
    try {
      message = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!message || typeof message !== "object") return null
  const { type, event, data } = message as { type?: unknown; event?: unknown; data?: unknown }
  if (type !== "WA_EMBEDDED_SIGNUP") return null
  if (typeof event !== "string" || !event.startsWith("FINISH")) return null
  if (!data || typeof data !== "object") return null

  const { waba_id, phone_number_id } = data as { waba_id?: unknown; phone_number_id?: unknown }
  const session: EmbeddedSignupSession = {}
  if (typeof waba_id === "string" && META_ID.test(waba_id)) session.wabaId = waba_id
  if (typeof phone_number_id === "string" && META_ID.test(phone_number_id)) {
    session.phoneNumberId = phone_number_id
  }
  return session.wabaId || session.phoneNumberId ? session : null
}
