import type { Contact } from "@/services/api"

/**
 * Opt-in/opt-out reasoning shared by the contacts list and the contact profile.
 *
 * Extracted from `app/dashboard/contacts/page.tsx` when the profile page needed
 * the same rules. Consent is the one thing in this product that must read the
 * same everywhere — a contact shown as re-openable on one screen and locked on
 * another is a compliance problem, not a cosmetic inconsistency.
 */

/**
 * Where a recorded consent came from.
 *
 * The backend stores this as a free string (`source ?? 'api'`, max 100 chars),
 * so the vocabulary has to live here or every screen invents its own. Recording
 * *where* consent happened is the difference between an auditable record and a
 * boolean somebody flipped.
 */
export interface ConsentSource {
  value: string
  label: string
  /** Shown under the option — what the user is actually attesting to. */
  hint: string
}

export const CONSENT_SOURCES: readonly ConsentSource[] = [
  {
    value: "existing_records",
    label: "Existing opt-in records",
    hint: "They agreed somewhere you already keep a record of — a CRM, a POS, a past signup.",
  },
  {
    value: "web_form",
    label: "Website or signup form",
    hint: "They ticked a box to hear from you on WhatsApp.",
  },
  {
    value: "order_checkout",
    label: "At checkout or order confirmation",
    hint: "They agreed to WhatsApp updates while buying something.",
  },
  {
    value: "in_store",
    label: "In person or in store",
    hint: "They gave their number and agreed to be messaged.",
  },
  {
    value: "phone_or_email",
    label: "Asked by phone or email",
    hint: "You asked and they said yes, outside WhatsApp.",
  },
]

export const OPT_IN_SOURCE_LABELS: Record<string, string> = {
  api: "Manually",
  // The list and profile call optInContact() with its "manual" default, which
  // the backend stores verbatim — without this the source silently vanished
  // from the tooltip for every contact opted in from the UI.
  manual: "Manually",
  csv_import: "CSV import",
  whatsapp_keyword: "WhatsApp keyword",
  ...Object.fromEntries(CONSENT_SOURCES.map((s) => [s.value, s.label])),
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
  if (!contact.optedOutAt) {
    return "No consent recorded — broadcasts reach them, drip sequences don't"
  }
  return `Opted out${when ? ` — ${when}` : ""}`
}

/**
 * Three states, not two. `optedIn` false covers both someone who said STOP
 * and someone nobody ever asked — and since broadcasts now reach the second
 * kind (only a withdrawal blocks them; see backend audience.service.ts),
 * showing both as "Opted out" told users the wrong people were unreachable.
 * Drips still need an opt-in.
 */
export type ConsentState = "in" | "out" | "none"

export function consentState(contact: Pick<Contact, "optedIn" | "optedOutAt">): ConsentState {
  if (contact.optedIn) return "in"
  return contact.optedOutAt ? "out" : "none"
}

export const CONSENT_STATE_LABELS: Record<ConsentState, string> = {
  in: "Opted in",
  out: "Opted out",
  none: "No consent",
}
