import type { SegmentCondition, SegmentRules } from "@/services/api"

// Loose editing model for one condition row — everything is a string so the
// inputs stay controlled; serialize to the typed API shape only when complete.
export interface ConditionDraft {
  type: "field" | "attribute" | "tag" | "activity" | "campaign"
  field: "name" | "waId" | "optedIn" | "createdAt"
  operator: string
  value: string // text value / yyyy-mm-dd for createdAt / tag name
  key: string // attribute key
  days: string
  event: "received" | "read" | "replied"
  campaignId: string // "" = any campaign
}

export const MAX_CONDITIONS = 20

export function emptyCondition(): ConditionDraft {
  return {
    type: "field",
    field: "name",
    operator: "equals",
    value: "",
    key: "",
    days: "30",
    event: "received",
    campaignId: "",
  }
}

export const CONDITION_TYPE_OPTIONS = [
  { value: "field", label: "Contact field" },
  { value: "attribute", label: "Custom attribute" },
  { value: "tag", label: "Tag" },
  { value: "activity", label: "Conversation activity" },
  { value: "campaign", label: "Campaign behavior" },
] as const

export const FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "waId", label: "Phone" },
  { value: "optedIn", label: "Opt-in status" },
  { value: "createdAt", label: "Created date" },
] as const

const TEXT_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "doesn't equal" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
]

export function operatorOptionsFor(draft: ConditionDraft): { value: string; label: string }[] {
  switch (draft.type) {
    case "field":
      if (draft.field === "optedIn")
        return [
          { value: "is_true", label: "is opted in" },
          { value: "is_false", label: "is opted out" },
        ]
      if (draft.field === "createdAt")
        return [
          { value: "before", label: "before" },
          { value: "after", label: "after" },
        ]
      return TEXT_OPERATORS
    case "attribute":
      return [
        ...TEXT_OPERATORS.filter((o) => o.value !== "starts_with"),
        { value: "exists", label: "exists" },
        { value: "not_exists", label: "doesn't exist" },
      ]
    case "tag":
      return [
        { value: "has", label: "has tag" },
        { value: "not_has", label: "doesn't have tag" },
      ]
    case "activity":
      return [
        { value: "active_within", label: "active in last" },
        { value: "inactive_within", label: "inactive for" },
      ]
    case "campaign":
      return [
        { value: "within", label: "within last" },
        { value: "not_within", label: "not within last" },
      ]
  }
}

// When the type/field changes, snap the operator to a valid one.
export function normalizeOperator(draft: ConditionDraft): ConditionDraft {
  const options = operatorOptionsFor(draft)
  if (!options.some((o) => o.value === draft.operator)) {
    return { ...draft, operator: options[0].value }
  }
  return draft
}

export function conditionNeedsValue(draft: ConditionDraft): boolean {
  if (draft.type === "field") return draft.field !== "optedIn"
  if (draft.type === "attribute") return draft.operator !== "exists" && draft.operator !== "not_exists"
  if (draft.type === "tag") return true
  return false
}

function daysValid(days: string): boolean {
  const n = Number(days)
  return Number.isInteger(n) && n >= 1 && n <= 365
}

// null = complete; otherwise a human-readable problem for that row.
export function conditionError(draft: ConditionDraft): string | null {
  switch (draft.type) {
    case "field":
      if (draft.field === "optedIn") return null
      if (!draft.value.trim()) return draft.field === "createdAt" ? "Pick a date" : "Enter a value"
      return null
    case "attribute":
      if (!draft.key.trim()) return "Enter an attribute key"
      if (conditionNeedsValue(draft) && !draft.value.trim()) return "Enter a value"
      return null
    case "tag":
      if (!draft.value.trim()) return "Pick a tag"
      return null
    case "activity":
      if (!daysValid(draft.days)) return "Days must be 1–365"
      return null
    case "campaign":
      if (!daysValid(draft.days)) return "Days must be 1–365"
      return null
  }
}

export function toApiCondition(draft: ConditionDraft): SegmentCondition {
  switch (draft.type) {
    case "field":
      if (draft.field === "optedIn")
        return { type: "field", field: "optedIn", operator: draft.operator as "is_true" | "is_false" }
      if (draft.field === "createdAt")
        return {
          type: "field",
          field: "createdAt",
          operator: draft.operator as "before" | "after",
          value: new Date(draft.value).toISOString(),
        }
      return {
        type: "field",
        field: draft.field,
        operator: draft.operator as "equals" | "not_equals" | "contains" | "starts_with",
        value: draft.value.trim(),
      }
    case "attribute":
      if (draft.operator === "exists" || draft.operator === "not_exists")
        return { type: "attribute", key: draft.key.trim(), operator: draft.operator }
      return {
        type: "attribute",
        key: draft.key.trim(),
        operator: draft.operator as "equals" | "not_equals" | "contains",
        value: draft.value.trim(),
      }
    case "tag":
      return { type: "tag", operator: draft.operator as "has" | "not_has", value: draft.value.trim() }
    case "activity":
      return {
        type: "activity",
        operator: draft.operator as "active_within" | "inactive_within",
        days: Number(draft.days),
      }
    case "campaign":
      return {
        type: "campaign",
        event: draft.event,
        operator: draft.operator as "within" | "not_within",
        days: Number(draft.days),
        ...(draft.campaignId ? { campaignId: draft.campaignId } : {}),
      }
  }
}

export function fromApiCondition(c: SegmentCondition): ConditionDraft {
  const draft = emptyCondition()
  draft.type = c.type
  switch (c.type) {
    case "field":
      draft.field = c.field
      draft.operator = c.operator
      if ("value" in c && c.value != null) {
        // date inputs want yyyy-mm-dd
        draft.value = c.field === "createdAt" ? String(c.value).slice(0, 10) : String(c.value)
      }
      break
    case "attribute":
      draft.key = c.key
      draft.operator = c.operator
      if ("value" in c && c.value != null) draft.value = String(c.value)
      break
    case "tag":
      draft.operator = c.operator
      draft.value = c.value
      break
    case "activity":
      draft.operator = c.operator
      draft.days = String(c.days)
      break
    case "campaign":
      draft.event = c.event
      draft.operator = c.operator
      draft.days = String(c.days)
      draft.campaignId = c.campaignId || ""
      break
  }
  return draft
}

const EVENT_VERBS: Record<string, string> = {
  received: "received",
  read: "read",
  replied: "replied to",
}

// Readable sentence for one saved condition ("tag has vip", "inactive for 30 days").
export function describeCondition(
  c: SegmentCondition,
  campaignName?: (id: string) => string | undefined
): string {
  switch (c.type) {
    case "field":
      if (c.field === "optedIn") return c.operator === "is_true" ? "is opted in" : "is opted out"
      if (c.field === "createdAt")
        return `created ${c.operator} ${new Date(c.value).toLocaleDateString()}`
      return `${c.field === "waId" ? "phone" : "name"} ${c.operator.replace(/_/g, " ")} “${c.value}”`
    case "attribute":
      if (!("value" in c))
        return `attribute ${c.key} ${c.operator === "exists" ? "exists" : "doesn't exist"}`
      return `attribute ${c.key} ${c.operator.replace(/_/g, " ")} “${c.value}”`
    case "tag":
      return c.operator === "has" ? `tag has ${c.value}` : `doesn't have tag ${c.value}`
    case "activity":
      return c.operator === "active_within"
        ? `active in last ${c.days} days`
        : `inactive for ${c.days} days`
    case "campaign": {
      const target = c.campaignId ? campaignName?.(c.campaignId) || "a campaign" : "any campaign"
      const negation = c.operator === "not_within" ? "didn't " : ""
      const verb = negation
        ? c.event === "replied"
          ? "reply to"
          : c.event === "read"
            ? "read"
            : "receive"
        : EVENT_VERBS[c.event]
      return `${negation}${verb} ${target} within ${c.days} days`
    }
  }
}

// Parses "Invalid segment rules: conditions[3].value — must be ..." style 400s
// so the builder can pin the message to the offending row.
export function parseRulesErrorIndex(message: string): number | null {
  const m = message.match(/conditions[.[](\d+)/)
  return m ? Number(m[1]) : null
}

export function buildRules(combinator: "and" | "or", drafts: ConditionDraft[]): SegmentRules {
  return { combinator, conditions: drafts.map(toApiCondition) }
}
