import { Badge } from "@/components/ui/badge"
import { CONSENT_STATE_LABELS, consentState } from "@/lib/contact-consent"
import type { Contact } from "@/services/api"

/** Opted in / No consent / Opted out — see `consentState` for why it is three. */
export function ConsentBadge({ contact }: { contact: Pick<Contact, "optedIn" | "optedOutAt"> }) {
  const state = consentState(contact)
  if (state === "in") {
    return <Badge className="bg-success-soft text-success hover:bg-success-soft">{CONSENT_STATE_LABELS.in}</Badge>
  }
  if (state === "none") {
    return (
      <Badge variant="outline" className="border-warning/40 text-warning">
        {CONSENT_STATE_LABELS.none}
      </Badge>
    )
  }
  return <Badge variant="secondary">{CONSENT_STATE_LABELS.out}</Badge>
}
