import type { FlowNode } from "@/services/api"

/**
 * One colour per node type, shared by the canvas card and the inspector badge
 * so a node reads the same in both places. `accentClass` is the canvas card's
 * left edge — the type is recognisable at zoomed-out sizes where the badge text
 * is unreadable.
 */
export const NODE_TYPE_META: Record<
  FlowNode["type"],
  { label: string; badgeClass: string; accentClass: string; hint: string }
> = {
  message: {
    label: "Message",
    badgeClass: "bg-info-soft text-info",
    accentClass: "bg-info",
    hint: "Sends text, then moves on",
  },
  buttons: {
    label: "Buttons",
    badgeClass: "bg-chart-4/10 text-chart-4",
    accentClass: "bg-chart-4",
    hint: "Sends up to 3 tappable replies and waits",
  },
  question: {
    label: "Question",
    badgeClass: "bg-warning-soft text-warning",
    accentClass: "bg-warning",
    hint: "Asks, saves the reply as a variable",
  },
  condition: {
    label: "Branch",
    badgeClass: "bg-chart-2/10 text-chart-2",
    accentClass: "bg-chart-2",
    hint: "Sends nothing — picks a path from an answer",
  },
  delay: {
    label: "Wait",
    badgeClass: "bg-info-soft text-info",
    accentClass: "bg-info",
    hint: "Pauses on a timer, up to 24 hours",
  },
  handoff: {
    label: "Handoff",
    badgeClass: "bg-destructive-soft text-destructive",
    accentClass: "bg-destructive",
    hint: "Hands the conversation to an agent",
  },
  end: {
    label: "End",
    badgeClass: "bg-muted text-foreground",
    accentClass: "bg-muted-foreground",
    hint: "Closes the session",
  },
}

export const NODE_TYPES = Object.keys(NODE_TYPE_META) as FlowNode["type"][]
