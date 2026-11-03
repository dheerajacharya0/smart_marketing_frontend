/**
 * Meta Embedded Signup reports what the customer picked (WABA + phone number)
 * through a `window.postMessage` from facebook.com, separate from the FB.login
 * callback that carries the `code`. With sessionInfoVersion 3 the payload is:
 *
 *   { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id, waba_id } }
 *
 * Coexistence (a number kept on the WhatsApp Business app) finishes with
 * FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING, same data.
 *
 * Without it the backend can only take the first number Meta lists in the WABA,
 * which on a second signup re-links the old number instead of adding the new one.
 */

export interface EmbeddedSignupSession {
  wabaId?: string
  phoneNumberId?: string
  /**
   * Which outcome Meta actually ran, read off the event name — not the
   * `featureType` the caller declared before launch. Used as a safety-net
   * override in `connect-whatsapp-button.tsx` when the two disagree (e.g. the
   * number turned out to already be on the app).
   */
  mode?: "new" | "coexistence"
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
  const envelope = readEnvelope(origin, raw)
  if (!envelope || !envelope.event.startsWith("FINISH")) return null

  const { waba_id, phone_number_id } = envelope.data as { waba_id?: unknown; phone_number_id?: unknown }
  const session: EmbeddedSignupSession = {}
  if (typeof waba_id === "string" && META_ID.test(waba_id)) session.wabaId = waba_id
  if (typeof phone_number_id === "string" && META_ID.test(phone_number_id)) {
    session.phoneNumberId = phone_number_id
  }
  if (session.wabaId || session.phoneNumberId) {
    session.mode = envelope.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" ? "coexistence" : "new"
  }
  return session.wabaId || session.phoneNumberId ? session : null
}

/**
 * Why the popup closed without a code, when Meta said. A CANCEL event carries
 * either the step the customer abandoned (`current_step`) or, when they left
 * after Meta showed an error, that error (`error_message`, `error_id`).
 */
export interface EmbeddedSignupCancel {
  step?: string
  errorMessage?: string
  errorId?: string
}

const MAX_CANCEL_TEXT = 500

export function parseEmbeddedSignupCancel(origin: string, raw: unknown): EmbeddedSignupCancel | null {
  const envelope = readEnvelope(origin, raw)
  if (!envelope || envelope.event !== "CANCEL") return null

  const { current_step, error_message, error_id } = envelope.data as {
    current_step?: unknown
    error_message?: unknown
    error_id?: unknown
  }
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_CANCEL_TEXT) : undefined
  const cancel: EmbeddedSignupCancel = {}
  const step = text(current_step)
  const errorMessage = text(error_message)
  const errorId = typeof error_id === "number" ? String(error_id) : text(error_id)
  if (step) cancel.step = step
  if (errorMessage) cancel.errorMessage = errorMessage
  if (errorId) cancel.errorId = errorId
  return cancel
}

/**
 * Meta's numeric diagnostic for a failed attempt — distinct from CANCEL, fired
 * as soon as the popup shows a rejection, whether or not the customer then
 * closes it. Meta's own docs say to capture `error_code` and `session_id`
 * "when contacting support" — the generic on-screen text alone ("already
 * registered to a WhatsApp account...") isn't enough to tell a plain
 * already-registered rejection from a Coexistence-specific one (Meta's
 * Coexistence error table is numeric, in the 3441xxx/2655xxx range; the
 * generic phone-setup table has no codes at all).
 */
export interface EmbeddedSignupError {
  code?: string
  message?: string
  sessionId?: string
  timestamp?: string
}

export function parseEmbeddedSignupError(origin: string, raw: unknown): EmbeddedSignupError | null {
  const envelope = readEnvelope(origin, raw)
  if (!envelope || envelope.event !== "ERROR") return null

  const { error_code, error_message, session_id, timestamp } = envelope.data as {
    error_code?: unknown
    error_message?: unknown
    session_id?: unknown
    timestamp?: unknown
  }
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_CANCEL_TEXT) : undefined
  const asString = (value: unknown) => (typeof value === "number" ? String(value) : text(value))
  const error: EmbeddedSignupError = {}
  const code = asString(error_code)
  const message = text(error_message)
  const sessionId = asString(session_id)
  const ts = asString(timestamp)
  if (code) error.code = code
  if (message) error.message = message
  if (sessionId) error.sessionId = sessionId
  if (ts) error.timestamp = ts
  return error
}

/**
 * Meta refused the number because it is still live on a WhatsApp app — the
 * "already registered to a WhatsApp account" error. Matched on the wording:
 * Meta documents no stable error id for it.
 */
export function isNumberInUseCancel(cancel: EmbeddedSignupCancel | null | undefined): boolean {
  return Boolean(cancel?.errorMessage && /already registered/i.test(cancel.errorMessage))
}

function readEnvelope(origin: string, raw: unknown): { event: string; data: object } | null {
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
  if (type !== "WA_EMBEDDED_SIGNUP" || typeof event !== "string") return null
  if (!data || typeof data !== "object") return null
  return { event, data }
}
