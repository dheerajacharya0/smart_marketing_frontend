import type {
  AutomationAction,
  AutomationCondition,
  AutomationConditions,
  AutomationRuleDetails,
  AutomationTrigger,
  AutomationTriggerType,
} from "@/services/api"

/**
 * Mirrors the backend's `src/automation/automation-rules.ts` zod schemas so the
 * rule builder can show inline errors instead of turning every mistake into a
 * 400. The backend stays the source of truth — anything here that disagrees is
 * a bug here, and every limit below is copied from a zod constraint, not
 * invented.
 *
 * Limits are exported rather than inlined so the form inputs (`maxLength`,
 * `max`) and the validator can't drift apart.
 */

export const NAME_MAX = 200
export const KEYWORDS_MAX = 50
export const BUTTON_IDS_MAX = 50
export const TAG_MAX = 100
export const NO_REPLY_HOURS_MIN = 1
/** 30 days. Past that the 24h session window is long shut and only a template can send. */
export const NO_REPLY_HOURS_MAX = 720
export const CONDITIONS_MAX = 20
export const ACTIONS_MIN = 1
export const ACTIONS_MAX = 10
export const SEND_TEXT_MAX = 4096
export const ATTRIBUTE_KEY_MAX = 100
export const ATTRIBUTE_VALUE_MAX = 1000
export const TEMPLATE_PARAMETERS_MAX = 20
export const WEBHOOK_URL_MAX = 2000
export const PRIORITY_MIN = 0
export const PRIORITY_MAX = 1000

export interface RuleIssue {
  /** Which part of the form to point at. */
  field: "name" | "phoneNumberId" | "trigger" | "conditions" | "actions" | "priority"
  /** Index within `conditions` / `actions`, when the issue is on one row. */
  index?: number
  message: string
}

// ---- Vocabulary ----------------------------------------------------------

export const TRIGGER_TYPES: readonly AutomationTriggerType[] = [
  "keyword",
  "button",
  "new_contact",
  "tag_added",
  "no_reply",
]

export type AutomationActionType = AutomationAction["type"]

export const ACTION_TYPES: readonly AutomationActionType[] = [
  "send_text",
  "send_template",
  "add_tag",
  "remove_tag",
  "set_attribute",
  "assign_agent",
  "start_flow",
  "call_webhook",
]

export type AutomationConditionType = AutomationCondition["type"]

export const CONDITION_TYPES: readonly AutomationConditionType[] = [
  "tag",
  "attribute",
  "opted_in",
  "text",
]

/** Plain-language labels — the builder never shows a raw discriminator. */
export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  keyword: "Someone sends a message",
  button: "Someone taps a button",
  new_contact: "A new contact is added",
  tag_added: "A tag is added to a contact",
  no_reply: "Nobody replied for a while",
}

export const TRIGGER_HINTS: Record<AutomationTriggerType, string> = {
  keyword: "Fires on inbound text. Use the catch-all match to reply to anything.",
  button: "Fires when someone taps a button in one of your messages.",
  new_contact: "Fires once, when the contact is first created.",
  tag_added: "Fires whenever this tag is added — including by another rule.",
  no_reply: "Fires when your last message has gone unanswered for this long.",
}

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  send_text: "Send a text message",
  send_template: "Send a template",
  add_tag: "Add a tag",
  remove_tag: "Remove a tag",
  set_attribute: "Set a contact field",
  assign_agent: "Assign to a teammate",
  start_flow: "Start a bot flow",
  call_webhook: "Call a webhook",
}

export const CONDITION_LABELS: Record<AutomationConditionType, string> = {
  tag: "Contact tag",
  attribute: "Contact field",
  opted_in: "Opt-in status",
  text: "Message text",
}

// ---- Defaults ------------------------------------------------------------

export function defaultTrigger(type: AutomationTriggerType): AutomationTrigger {
  switch (type) {
    case "keyword":
      return { type: "keyword", matchType: "contains", keywords: [] }
    case "button":
      return { type: "button", buttonIds: [] }
    case "new_contact":
      return { type: "new_contact" }
    case "tag_added":
      return { type: "tag_added", tag: "" }
    case "no_reply":
      return { type: "no_reply", hours: 24 }
  }
}

export function defaultAction(type: AutomationActionType): AutomationAction {
  switch (type) {
    case "send_text":
      return { type: "send_text", text: "" }
    case "send_template":
      return { type: "send_template", templateName: "", templateLanguage: "" }
    case "add_tag":
      return { type: "add_tag", tag: "" }
    case "remove_tag":
      return { type: "remove_tag", tag: "" }
    case "set_attribute":
      return { type: "set_attribute", key: "", value: "" }
    case "assign_agent":
      return { type: "assign_agent", agentUserId: "" }
    case "start_flow":
      return { type: "start_flow", flowId: "" }
    case "call_webhook":
      return { type: "call_webhook", url: "", includeContact: true }
  }
}

export function defaultCondition(type: AutomationConditionType): AutomationCondition {
  switch (type) {
    case "tag":
      return { type: "tag", operator: "has", value: "" }
    case "attribute":
      return { type: "attribute", key: "", operator: "equals", value: "" }
    case "opted_in":
      return { type: "opted_in", value: true }
    case "text":
      return { type: "text", operator: "contains", value: "" }
  }
}

/** Attribute operators that take no value — the value input hides for these. */
export function attributeOperatorTakesValue(
  operator: Extract<AutomationCondition, { type: "attribute" }>["operator"]
): boolean {
  return operator !== "exists" && operator !== "not_exists"
}

// ---- Validation ----------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function validateTrigger(trigger: AutomationTrigger): RuleIssue[] {
  const issues: RuleIssue[] = []
  switch (trigger.type) {
    case "keyword":
      // The one cross-field rule the server enforces separately from the schema:
      // a catch-all needs no keywords, anything else is unreachable without them.
      if (trigger.matchType !== "any" && trigger.keywords.length === 0) {
        issues.push({ field: "trigger", message: "Add at least one keyword" })
      }
      if (trigger.keywords.length > KEYWORDS_MAX) {
        issues.push({ field: "trigger", message: `At most ${KEYWORDS_MAX} keywords` })
      }
      break
    case "button":
      if (trigger.buttonIds.length > BUTTON_IDS_MAX) {
        issues.push({ field: "trigger", message: `At most ${BUTTON_IDS_MAX} button ids` })
      }
      break
    case "tag_added":
      if (!trigger.tag.trim()) {
        issues.push({ field: "trigger", message: "Pick the tag that should trigger this" })
      } else if (trigger.tag.length > TAG_MAX) {
        issues.push({ field: "trigger", message: `Tag is limited to ${TAG_MAX} characters` })
      }
      break
    case "no_reply":
      if (
        !Number.isInteger(trigger.hours) ||
        trigger.hours < NO_REPLY_HOURS_MIN ||
        trigger.hours > NO_REPLY_HOURS_MAX
      ) {
        issues.push({
          field: "trigger",
          message: `Wait time must be a whole number of hours between ${NO_REPLY_HOURS_MIN} and ${NO_REPLY_HOURS_MAX} (30 days)`,
        })
      }
      break
    case "new_contact":
      break
  }
  return issues
}

function validateCondition(condition: AutomationCondition, index: number): RuleIssue[] {
  const issues: RuleIssue[] = []
  const at = (message: string): RuleIssue => ({ field: "conditions", index, message })

  switch (condition.type) {
    case "tag":
      if (!condition.value.trim()) issues.push(at("Pick a tag"))
      break
    case "attribute":
      if (!condition.key.trim()) issues.push(at("Pick a contact field"))
      else if (condition.key.length > ATTRIBUTE_KEY_MAX) {
        issues.push(at(`Field name is limited to ${ATTRIBUTE_KEY_MAX} characters`))
      }
      if (attributeOperatorTakesValue(condition.operator) && !condition.value?.trim()) {
        issues.push(at("Enter a value to compare against"))
      }
      break
    case "text":
      if (!condition.value.trim()) issues.push(at("Enter the text to look for"))
      break
    case "opted_in":
      break
  }
  return issues
}

function validateAction(action: AutomationAction, index: number): RuleIssue[] {
  const issues: RuleIssue[] = []
  const at = (message: string): RuleIssue => ({ field: "actions", index, message })

  switch (action.type) {
    case "send_text":
      if (!action.text.trim()) issues.push(at("Message text is required"))
      else if (action.text.length > SEND_TEXT_MAX) {
        issues.push(at(`Message is limited to ${SEND_TEXT_MAX} characters`))
      }
      break
    case "send_template":
      if (!action.templateName.trim()) issues.push(at("Pick a template"))
      // Language is filled in from the picked template, so an empty one means
      // the template list and the selection have gone out of step.
      if (!action.templateLanguage.trim()) issues.push(at("Template language is missing"))
      if ((action.parameters?.length ?? 0) > TEMPLATE_PARAMETERS_MAX) {
        issues.push(at(`At most ${TEMPLATE_PARAMETERS_MAX} template values`))
      }
      break
    case "add_tag":
    case "remove_tag":
      if (!action.tag.trim()) issues.push(at("Tag is required"))
      else if (action.tag.length > TAG_MAX) {
        issues.push(at(`Tag is limited to ${TAG_MAX} characters`))
      }
      break
    case "set_attribute":
      if (!action.key.trim()) issues.push(at("Field name is required"))
      else if (action.key.length > ATTRIBUTE_KEY_MAX) {
        issues.push(at(`Field name is limited to ${ATTRIBUTE_KEY_MAX} characters`))
      }
      if (action.value.length > ATTRIBUTE_VALUE_MAX) {
        issues.push(at(`Value is limited to ${ATTRIBUTE_VALUE_MAX} characters`))
      }
      break
    case "assign_agent":
      if (!UUID_RE.test(action.agentUserId)) issues.push(at("Pick a teammate"))
      break
    case "start_flow":
      if (!UUID_RE.test(action.flowId)) issues.push(at("Pick a flow"))
      break
    case "call_webhook":
      if (!isHttpUrl(action.url)) issues.push(at("Enter a full http(s) URL"))
      else if (action.url.length > WEBHOOK_URL_MAX) {
        issues.push(at(`URL is limited to ${WEBHOOK_URL_MAX} characters`))
      }
      break
  }
  return issues
}

/**
 * Everything the server would reject, checked before we ask it. Returns every
 * issue rather than the first, so the form can mark all the bad rows at once.
 */
export function validateRule(
  rule: Pick<AutomationRuleDetails, "name" | "phoneNumberId" | "trigger" | "actions"> &
    Partial<Pick<AutomationRuleDetails, "conditions" | "priority">>
): RuleIssue[] {
  const issues: RuleIssue[] = []

  if (!rule.phoneNumberId) {
    issues.push({ field: "phoneNumberId", message: "Pick a phone number" })
  }
  if (!rule.name.trim()) {
    issues.push({ field: "name", message: "Name is required" })
  } else if (rule.name.length > NAME_MAX) {
    issues.push({ field: "name", message: `Name is limited to ${NAME_MAX} characters` })
  }

  issues.push(...validateTrigger(rule.trigger))

  const conditions = rule.conditions
  if (conditions) {
    // `{ combinator, conditions: [] }` is not "no conditions" to the server —
    // it fails `.min(1)`. Send null instead; the builder does that on save.
    if (conditions.conditions.length === 0) {
      issues.push({ field: "conditions", message: "Remove the condition group or add a condition" })
    } else if (conditions.conditions.length > CONDITIONS_MAX) {
      issues.push({ field: "conditions", message: `At most ${CONDITIONS_MAX} conditions` })
    }
    conditions.conditions.forEach((condition, i) => {
      issues.push(...validateCondition(condition, i))
    })
  }

  if (rule.actions.length < ACTIONS_MIN) {
    issues.push({ field: "actions", message: "Add at least one action" })
  } else if (rule.actions.length > ACTIONS_MAX) {
    issues.push({ field: "actions", message: `At most ${ACTIONS_MAX} actions` })
  }
  rule.actions.forEach((action, i) => {
    issues.push(...validateAction(action, i))
  })

  const priority = rule.priority
  if (priority != null) {
    if (!Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
      issues.push({
        field: "priority",
        message: `Priority must be a whole number between ${PRIORITY_MIN} and ${PRIORITY_MAX}`,
      })
    }
  }

  return issues
}

// ---- Summaries -----------------------------------------------------------

/** One-line "when this happens" for the rule list. */
export function describeTrigger(trigger: AutomationTrigger): string {
  switch (trigger.type) {
    case "keyword":
      if (trigger.matchType === "any") return "Any inbound message"
      return `Message ${trigger.matchType === "exact" ? "is" : "contains"} ${trigger.keywords.join(", ")}`
    case "button":
      return trigger.buttonIds.length ? `Button: ${trigger.buttonIds.join(", ")}` : "Any button tap"
    case "new_contact":
      return "New contact added"
    case "tag_added":
      return `Tag "${trigger.tag}" added`
    case "no_reply":
      return `No reply for ${trigger.hours}h`
  }
}

/**
 * One-line summary of a single action. `names` resolves the ids an action
 * stores — without it a rule reads "Assign to 8f3c…", which tells nobody
 * anything.
 */
export function describeAction(
  action: AutomationAction,
  names?: { flows?: Record<string, string>; agents?: Record<string, string> }
): string {
  switch (action.type) {
    case "send_text":
      return `Reply: ${action.text}`
    case "send_template":
      return `Send template ${action.templateName}`
    case "add_tag":
      return `Add tag "${action.tag}"`
    case "remove_tag":
      return `Remove tag "${action.tag}"`
    case "set_attribute":
      return `Set ${action.key} = ${action.value}`
    case "assign_agent":
      return `Assign to ${names?.agents?.[action.agentUserId] ?? action.agentName ?? "a teammate"}`
    case "start_flow":
      return `Start flow ${names?.flows?.[action.flowId] ?? action.flowId}`
    case "call_webhook":
      return `Call ${action.url}`
  }
}

/**
 * True when this rule swallows every inbound message on its number, making
 * every lower-priority keyword rule unreachable — only the first match fires.
 * A warning, not an error: the server allows it, and it is the right shape for
 * a last-resort fallback sitting at the highest priority number.
 */
export function isCatchAll(trigger: AutomationTrigger): boolean {
  return trigger.type === "keyword" && trigger.matchType === "any"
}

interface ShadowCandidate {
  id: string
  phoneNumberId: string
  isActive: boolean
  priority: number
  trigger: AutomationTrigger
  conditions?: AutomationConditions | null
}

/**
 * Rules that hide this one: an active, unconditional catch-all on the same
 * number running at the same priority or earlier (lower number). The server
 * fires only the first match and orders by priority alone, so a tie is
 * genuinely ambiguous and counts as shadowing.
 *
 * Scoped to keyword rules on both sides because the engine matches
 * `trigger.type` against the event type first — a keyword catch-all never
 * touches a `button`, `new_contact`, `tag_added` or `no_reply` rule. A catch-all
 * carrying conditions can decline to fire, so it doesn't shadow either.
 */
export function shadowedBy<T extends ShadowCandidate>(rule: T, all: readonly T[]): T[] {
  if (!rule.isActive || rule.trigger.type !== "keyword" || isCatchAll(rule.trigger)) return []
  return all.filter(
    (other) =>
      other.id !== rule.id &&
      other.isActive &&
      other.phoneNumberId === rule.phoneNumberId &&
      isCatchAll(other.trigger) &&
      !other.conditions &&
      other.priority <= rule.priority
  )
}

/** `{ combinator, conditions: [] }` is invalid server-side — send null. */
export function normalizeConditions(
  conditions: AutomationConditions | null | undefined
): AutomationConditions | null {
  if (!conditions || conditions.conditions.length === 0) return null
  return conditions
}
