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
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
    accentClass: "bg-blue-500",
    hint: "Sends text, then moves on",
  },
  buttons: {
    label: "Buttons",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-400",
    accentClass: "bg-violet-500",
    hint: "Sends up to 3 tappable replies and waits",
  },
  question: {
    label: "Question",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
    accentClass: "bg-amber-500",
    hint: "Asks, saves the reply as a variable",
  },
  condition: {
    label: "Branch",
    badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-400",
    accentClass: "bg-teal-500",
    hint: "Sends nothing — picks a path from an answer",
  },
  delay: {
    label: "Wait",
    badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400",
    accentClass: "bg-indigo-500",
    hint: "Pauses on a timer, up to 24 hours",
  },
  handoff: {
    label: "Handoff",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
    accentClass: "bg-red-500",
    hint: "Hands the conversation to an agent",
  },
  end: {
    label: "End",
    badgeClass: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    accentClass: "bg-gray-400",
    hint: "Closes the session",
  },
}

export const NODE_TYPES = Object.keys(NODE_TYPE_META) as FlowNode["type"][]
