"use client"

import { Badge } from "@/components/ui/badge"
import type { WhatsappFlowStatus } from "@/services/api"

/**
 * Meta's status, mirrored rather than tracked by us.
 *
 * `BLOCKED` and `THROTTLED` are imposed by Meta with no webhook, so they can be
 * stale in our copy until someone syncs — which is why they're styled as
 * problems rather than as neutral states.
 */
export function FlowStatusBadge({ status }: { status: WhatsappFlowStatus }) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="outline">Draft</Badge>
    case "PUBLISHED":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
          Published
        </Badge>
      )
    case "DEPRECATED":
      return <Badge variant="secondary">Retired</Badge>
    case "BLOCKED":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
          Blocked by Meta
        </Badge>
      )
    case "THROTTLED":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400">
          Throttled
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

/** Plain-language explanation of what a status means for the customer. */
export function flowStatusHint(status: WhatsappFlowStatus): string {
  switch (status) {
    case "DRAFT":
      return "Editable, and only deliverable to your own testers until you publish it."
    case "PUBLISHED":
      return "Live. The form itself can no longer be changed — publishing freezes it."
    case "DEPRECATED":
      return "Retired. It can't be sent any more."
    case "BLOCKED":
      return "Meta has stopped this flow from being delivered. Check your WhatsApp Manager for the reason."
    case "THROTTLED":
      return "Meta is limiting delivery of this flow, usually after quality or error signals."
    default:
      return ""
  }
}
