/**
 * An invitation code carried across sign-up, email verification and sign-in.
 *
 * The /invite page saves it; the login page reads it to open the right tab
 * with the invited address filled in; once signed in, the dashboard offers to
 * join with it. Without this the code lived only in the email, and someone who
 * had to create an account first had to go back and find it.
 *
 * Browser storage is a convenience here, not the record: the backend still
 * checks the code and the address on accept, and a verified user sees the
 * invite in-app anyway (`listMyTeamInvites`).
 */
const KEY = "pendingTeamInvite"
/** Invites expire after seven days, so a saved code is useless after that. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface PendingInvite {
  code: string
  /** The invite's id, to avoid offering it twice alongside `listMyTeamInvites`. */
  id: string | null
  /** The invited address — who should sign in or sign up. */
  email: string
  teamName: string | null
  /** Whether `email` already has an account (sign in) or not (sign up). */
  hasAccount: boolean
  savedAt: number
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function savePendingInvite(invite: Omit<PendingInvite, "savedAt">, now = Date.now()): void {
  try {
    storage()?.setItem(KEY, JSON.stringify({ ...invite, savedAt: now }))
  } catch {
    // Private mode or full storage: the emailed code still works.
  }
}

export function readPendingInvite(now = Date.now()): PendingInvite | null {
  try {
    const raw = storage()?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingInvite>
    if (typeof parsed.code !== "string" || !parsed.code || typeof parsed.email !== "string") {
      clearPendingInvite()
      return null
    }
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > MAX_AGE_MS) {
      clearPendingInvite()
      return null
    }
    return {
      code: parsed.code,
      id: typeof parsed.id === "string" ? parsed.id : null,
      email: parsed.email,
      teamName: typeof parsed.teamName === "string" ? parsed.teamName : null,
      hasAccount: parsed.hasAccount === true,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

export function clearPendingInvite(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}

/** Addresses compare case-insensitively, as the backend does. */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
