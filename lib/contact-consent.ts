import type { Contact } from "@/services/api"

/**
 * Opt-in/opt-out reasoning shared by the contacts list and the contact profile.
 *
 * Extracted from `app/dashboard/contacts/page.tsx` when the profile page needed
 * the same rules. Consent is the one thing in this product that must read the
 * same everywhere — a contact shown as re-openable on one screen and locked on
 * another is a compliance problem, not a cosmetic inconsistency.
 */

export const OPT_IN_SOURCE_LABELS: Record<string, string> = {
  api: "Manually",
  csv_import: "CSV import",
  whatsapp_keyword: "WhatsApp keyword",
}

/**
 * Contact unsubscribed themselves by texting STOP. Manual re-opt-in is a
 * compliance risk, so callers gate it behind an explicit consent confirmation.
 */
export function optedOutViaStop(contact: Contact): boolean {
  return !contact.optedIn && contact.optInSource === "whatsapp_keyword"
}

export function formatOptTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** One-line consent summary: state, how it happened, and when. */
export function optStatusTooltip(contact: Contact): string {
  if (contact.optedIn) {
    const source = contact.optInSource ? OPT_IN_SOURCE_LABELS[contact.optInSource] : null
    const when = formatOptTimestamp(contact.optedInAt)
    return `Opted in${source ? ` via ${source}` : ""}${when ? ` — ${when}` : ""}`
  }
  const when = formatOptTimestamp(contact.optedOutAt)
  if (optedOutViaStop(contact)) {
    return `Opted out via WhatsApp (texted STOP)${when ? ` — ${when}` : ""}`
  }
  return `Opted out${when ? ` — ${when}` : ""}`
}
