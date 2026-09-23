/**
 * Building the link that actually collects consent.
 *
 * An inbound WhatsApp message does **not** opt anyone in — the backend creates
 * contacts from inbound messages opted out on purpose, because a message is
 * consent to be replied to within the 24-hour window, not consent to marketing.
 * Consent comes from a keyword, an import that asserts it, or the API.
 *
 * So the only link that collects opt-in on its own is a `wa.me` link whose
 * prefilled text *is* an opt-in keyword: the person taps, their own WhatsApp
 * sends the word, and the webhook records consent as `whatsapp_keyword` with
 * their own message as the evidence. Anything else sends them into a chat that
 * leaves them unreachable by campaigns.
 *
 * Keywords mirror `src/contacts/opt-keywords.ts` on the backend, which matches
 * only when the keyword is the entire message — so the prefill must be the bare
 * word with nothing appended.
 */

/** Opt-in keywords the backend recognises, in the order worth offering. */
export const OPT_IN_KEYWORDS = ["START", "SUBSCRIBE", "OPT IN", "RESUME"] as const

export type OptInKeyword = (typeof OPT_IN_KEYWORDS)[number]

/** Digits only — `wa.me` rejects spaces, dashes and a leading `+`. */
export function toWaMeNumber(displayPhoneNumber: string): string {
  return displayPhoneNumber.replace(/\D/g, "")
}

/**
 * `https://wa.me/<digits>?text=<keyword>`.
 *
 * Returns null when the number has no digits, so callers render an explanation
 * rather than a link that opens WhatsApp to nowhere.
 */
export function buildOptInLink(displayPhoneNumber: string, keyword: string): string | null {
  const digits = toWaMeNumber(displayPhoneNumber)
  if (!digits) return null
  const word = keyword.trim()
  if (!word) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(word)}`
}

/**
 * Whether a prefill would still register as consent.
 *
 * The backend only treats a message as a keyword when the keyword is the whole
 * message, so "START - from the flyer" silently collects nothing: the person
 * thinks they subscribed, the business thinks the link works, and the contact
 * stays out of every campaign.
 */
export function prefillGrantsConsent(prefill: string): boolean {
  const normalized = prefill
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
  return (["start", "subscribe", "unstop", "optin", "opt in", "opt-in", "resume"] as const).includes(
    normalized as never,
  )
}
