import {
  getWhatsappBusinessAccount,
  listWhatsappPhoneNumbers,
  syncBusiness,
  type WhatsappPhoneNumber,
} from "@/services/api"

/**
 * A registered number with a display number you can actually show someone.
 *
 * `GET /whatsapp/phone-numbers` returns our own database copy, and that copy is
 * `displayPhoneNumber: null` on any number that was registered but never
 * synced — which is the state of a freshly onboarded account. Reading the
 * endpoint alone therefore reports "no numbers" for an account that visibly has
 * one, so anything that needs the number in user-facing text has to resolve it
 * the long way: sync, re-read, and fall back to Meta's own record.
 *
 * `app/dashboard/whatsapp/page.tsx` does this inline and predates this helper;
 * it can adopt it, but it also does other work in the same pass, so it was left
 * alone rather than refactored from underneath.
 */
export interface SenderNumber {
  id: string
  phoneNumberId: string
  wabaId: string
  /** Always non-empty — that is the point of this module. */
  displayPhoneNumber: string
  verifiedName: string | null
}

function usable(n: WhatsappPhoneNumber): boolean {
  return !!n.displayPhoneNumber
}

function toSender(n: WhatsappPhoneNumber, display: string, name?: string | null): SenderNumber {
  return {
    id: n.id,
    phoneNumberId: n.phoneNumberId,
    wabaId: n.wabaId,
    displayPhoneNumber: display,
    verifiedName: n.verifiedName ?? name ?? null,
  }
}

/**
 * Registered numbers with their display number filled in, cheapest path first.
 *
 * Never throws: every step is best-effort, and an empty array means "couldn't
 * resolve one", which callers should present as a setup prompt rather than an
 * error.
 */
export async function resolveSenderNumbers(accountId: string): Promise<SenderNumber[]> {
  let numbers: WhatsappPhoneNumber[] = []
  try {
    numbers = (await listWhatsappPhoneNumbers(accountId)) ?? []
  } catch {
    return []
  }

  const registered = numbers.filter((n) => n.status === "registered")
  if (registered.length === 0) return []

  // Happy path: our copy already has the number.
  if (registered.every(usable)) {
    return registered.map((n) => toSender(n, n.displayPhoneNumber as string))
  }

  // Ask the backend to re-pull from Meta, then re-read.
  try {
    await syncBusiness(accountId)
    const resynced = ((await listWhatsappPhoneNumbers(accountId)) ?? []).filter(
      (n) => n.status === "registered",
    )
    if (resynced.length > 0 && resynced.every(usable)) {
      return resynced.map((n) => toSender(n, n.displayPhoneNumber as string))
    }
    if (resynced.length > 0) numbers = resynced
  } catch {
    // Fall through to the per-WABA lookup below.
  }

  // Last resort: Meta's own record. One call for the whole account — the
  // endpoint is keyed by accountId and returns every WABA under it, so the
  // right WABA is picked out of the result rather than requested by id.
  const stillRegistered = numbers.filter((n) => n.status === "registered")
  const byWaba = new Map<string, { display?: string; name?: string | null }>()
  try {
    const res = await getWhatsappBusinessAccount(accountId)
    for (const waba of res?.data ?? []) {
      byWaba.set(waba.id, {
        display: waba.details?.display_phone_number,
        name: waba.details?.verified_name ?? null,
      })
    }
  } catch {
    // Leave the map empty — callers get "couldn't resolve", not a crash.
  }

  return stillRegistered
    .map((n) => {
      const display = n.displayPhoneNumber || byWaba.get(n.wabaId)?.display
      return display ? toSender(n, display, byWaba.get(n.wabaId)?.name) : null
    })
    .filter((n): n is SenderNumber => n !== null)
}
