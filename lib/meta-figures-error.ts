/**
 * Display rules for a WABA whose Meta figures (charges, template costs)
 * failed to load. The backend writes `error` for customers, but older
 * backends passed Meta's developer message straight through ("Unsupported get
 * request. Object with ID ... Please read the Graph API documentation at
 * ..."), so anything that still looks like that is replaced here.
 */

const GENERIC = "Meta couldn't return its figures right now. Try again later."

/** Developer-facing Graph text: object ids, doc links, OAuth jargon. */
const RAW_GRAPH = /graph api|developers\.facebook\.com|object with id|unsupported get request|oauthexception/i

export function metaFiguresErrorText(error: string | null | undefined): string {
  if (!error || RAW_GRAPH.test(error)) return GENERIC
  return error
}

/** Both mean the customer's Facebook connection can't reach this WABA: reconnecting fixes it. */
export function needsReconnect(errorCode: string | null | undefined): boolean {
  return errorCode === "reconnect" || errorCode === "no_access"
}
