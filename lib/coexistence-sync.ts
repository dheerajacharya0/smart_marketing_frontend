import type { WhatsappPhoneNumber } from "@/services/api"

/** Meta's deadline for importing a coexistence number's app data, from onboarding. */
export const COEXISTENCE_SYNC_WINDOW_MS = 24 * 60 * 60 * 1000

type SyncFields = Pick<
  WhatsappPhoneNumber,
  "coexistence" | "coexistenceOnboardedAt" | "coexistenceSyncStartedAt" | "coexistenceSyncError"
>

export type CoexistenceSyncState =
  /** Not a coexistence number, or nothing to say about it. */
  | { kind: "none" }
  /** The import request failed and can still be retried until `deadline`. */
  | { kind: "retry"; deadline: Date; error: string }
  /** The import never started and Meta's window has closed. */
  | { kind: "expired"; error: string }

/**
 * Whether a number's WhatsApp Business app import needs attention. Mirrors the
 * backend's retry rule: only a failed, unstarted import, and only inside the
 * 24 hours Meta allows.
 */
export function coexistenceSyncState(n: SyncFields, now: number = Date.now()): CoexistenceSyncState {
  if (!n.coexistence || n.coexistenceSyncStartedAt || !n.coexistenceSyncError) return { kind: "none" }
  const onboardedAt = n.coexistenceOnboardedAt ? new Date(n.coexistenceOnboardedAt).getTime() : NaN
  if (!Number.isFinite(onboardedAt)) return { kind: "none" }
  const deadline = onboardedAt + COEXISTENCE_SYNC_WINDOW_MS
  return deadline > now
    ? { kind: "retry", deadline: new Date(deadline), error: n.coexistenceSyncError }
    : { kind: "expired", error: n.coexistenceSyncError }
}
