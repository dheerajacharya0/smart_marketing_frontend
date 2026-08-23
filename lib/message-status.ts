/**
 * Outbound message status — ordering it, and explaining a failure.
 *
 * A send response is not an outcome. `{ messages: [{ id, message_status:
 * "accepted" }] }` means Meta has queued the message; delivery or failure
 * arrives seconds later, over the WebSocket or on the next fetch of the
 * thread. So a bubble starts as pending and is only ever *upgraded* by a real
 * status event.
 *
 * Meta redelivers status webhooks, and they can arrive out of order — a late
 * `delivered` after a `read` is normal traffic. Rank them and ignore anything
 * that ranks below what is already on screen, or the thread will show a
 * message un-reading itself.
 */

/** `sent < delivered < read < failed`. Everything else is "not yet handed over". */
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

export function statusRank(status?: string | null): number {
  if (!status) return 0
  return STATUS_RANK[status.toLowerCase()] ?? 0
}

/**
 * The status to show, given what is on screen and what just arrived.
 *
 * `failed` outranks everything, deliberately: a message that failed did not
 * arrive, and a `delivered` row Meta re-sends afterwards must never talk the
 * UI back out of saying so.
 */
export function mergeStatus(
  current?: string | null,
  incoming?: string | null
): string | undefined {
  if (!incoming) return current ?? undefined
  if (!current) return incoming
  return statusRank(incoming) >= statusRank(current) ? incoming : current
}

/** True once the message has left our side and Meta has confirmed something. */
export function isTerminalFailure(status?: string | null): boolean {
  return status?.toLowerCase() === "failed"
}

export interface MessageFailure {
  /** Meta's numeric code, e.g. 131026. */
  code?: number | null
  /** Meta's title — often generic ("Message undeliverable"). */
  title?: string | null
  /** The specific half, when Meta sends one. Preferred over the title. */
  details?: string | null
}

/**
 * Plain-language replacements for the codes that come up often enough that
 * Meta's own wording ("Message undeliverable") leaves the user with nothing to
 * act on. Anything not listed falls back to the raw code plus whatever text
 * came with it — never to a bare "failed".
 */
export const META_ERROR_HINTS: Record<number, string> = {
  131026: "Not delivered — that number isn't on WhatsApp, or it isn't a valid number.",
  131047: "The 24-hour window has closed. An approved template is the only way to reach them now.",
}

/**
 * Meta's `statuses[]` entry, narrowed to the failure half — mirrors the
 * backend's `MetaStatus` in `src/webhook/outbound-status-mirror.ts`.
 */
interface MetaStatusPayload {
  errors?: {
    code?: number
    title?: string
    error_data?: { details?: string }
  }[]
}

/**
 * The failure, read off a raw status payload.
 *
 * Needed because the two ways a status reaches us do **not** carry the same
 * columns, despite describing the same event. `GET /chat/conversations/:id/
 * messages` returns the *outbound* row, onto which the backend has mirrored
 * `errorCode` / `errorTitle` / `errorDetails`. The realtime event is the
 * *status* row, and the mirror is a separate `UPDATE` against the outbound
 * record — so those three columns are null on the socket payload and the only
 * copy of the reason is Meta's own `errors[]` inside it.
 *
 * Without this, a send that fails while the thread is open renders as "Failed"
 * with nothing next to it until something triggers a refetch.
 */
export function failureFromPayload(payload: unknown): MessageFailure {
  const error = (payload as MetaStatusPayload | null | undefined)?.errors?.[0]
  if (!error) return {}
  return {
    code: error.code ?? null,
    title: error.title ?? null,
    details: error.error_data?.details ?? null,
  }
}

/** One sentence saying why a send failed, for the red bubble. */
export function failureReason(failure: MessageFailure): string {
  const details = failure.details?.trim()
  const title = failure.title?.trim()
  const hint = failure.code != null ? META_ERROR_HINTS[failure.code] : undefined

  if (hint) return details ? `${hint} — ${details}` : hint

  // `errorDetails` is the specific half and `errorTitle` the generic one, so
  // prefer details and fall back to the title.
  const text = details || title
  if (text) return failure.code != null ? `${text} (error ${failure.code})` : text
  return failure.code != null ? `Delivery failed (error ${failure.code})` : "Delivery failed"
}
