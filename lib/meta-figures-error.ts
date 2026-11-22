/**
 * Display rules for a WABA whose Meta figures (charges, template costs)
 * failed to load. The backend writes `error` for customers, but older
 * backends passed Meta's developer message straight through ("Unsupported get
 * request. Object with ID ... Please read the Graph API documentation at
 * ..."), so anything that still looks like that is replaced here.
 *
 * Advice comes from `errorCode` only, never guessed from Meta's text: the
 * text can't tell an expired login (reconnect fixes it) from an app-level
 * permission or a deleted WABA (it doesn't), and advice must always match
 * whether the Reconnect button is shown.
 */

/** `reconnect`: the login itself expired or was revoked. */
export const RECONNECT_EXPIRED =
  "Meta no longer accepts this connection. Reconnect WhatsApp to see Meta's figures."
/** `no_access`: the login is fine but can't reach this WhatsApp account. */
export const RECONNECT_NO_ACCESS =
  "Meta won't share these figures with this WhatsApp connection. Reconnect WhatsApp to fix it."
/** Neutral on purpose: no "try again later" for something waiting can't fix. */
export const NEUTRAL = "Meta didn't return figures for this WhatsApp account."

/**
 * Developer-only markers, so text the backend writes for customers is never
 * swallowed by a phrase it happens to share: Meta's "(#N)" code prefix, trace
 * ids, doc links and object ids, and Meta's stock messages matched only from
 * the start of the string, where Meta puts them.
 */
const RAW_GRAPH = new RegExp(
  [
    String.raw`^\s*\(#\d+\)`,
    "fbtrace",
    String.raw`developers\.facebook\.com`,
    "graph api documentation",
    "object with id",
    "^unsupported get request",
    "^error validating access token",
    "^invalid oauth",
    "^invalid parameter",
    "^an unknown error",
    "^please reduce the amount of data",
  ].join("|"),
  "i",
)

/** Both mean the customer's Facebook connection can't reach this WABA: reconnecting fixes it. */
export function needsReconnect(errorCode: string | null | undefined): boolean {
  return errorCode === "reconnect" || errorCode === "no_access"
}

export function metaFiguresErrorText(
  error: string | null | undefined,
  errorCode?: string | null,
): string {
  if (error && !RAW_GRAPH.test(error.trim())) return error
  // Same test as the Reconnect button, so the text never promises a fix the
  // card doesn't offer — and each reconnect case names its own cause.
  if (errorCode === "reconnect") return RECONNECT_EXPIRED
  if (errorCode === "no_access") return RECONNECT_NO_ACCESS
  return NEUTRAL
}
