/**
 * Plain-language glossary for Meta / WhatsApp Business jargon.
 *
 * Every term the UI shows raw (WABA, quality rating, messaging tier, phone
 * number ID, opt-in source, service window…) is defined here once, and read by
 * both the inline `<Explain>` tooltip and the /dashboard/glossary page. One
 * source of truth so a tooltip can never drift from the glossary entry.
 *
 * Writing rules for entries:
 * - `short` is what a non-technical small-business owner reads on hover. Two
 *   sentences max, no jargon inside the definition of jargon.
 * - `long` adds the "so what" — why it matters or what to do about it. Shown on
 *   the glossary page only.
 * - `learnMore` points at Meta's own docs, never at an in-app page we invented.
 *   Omit it rather than guess a URL.
 */

export interface GlossaryEntry {
  /** Stable slug — the `term` prop passed to <Explain>. Also the anchor id. */
  id: string
  /** Display name, as the product should say it. */
  term: string
  /** Other names for the same thing, including Meta's raw spelling. Searchable. */
  aliases?: readonly string[]
  /** Hover definition. Plain language, no nested jargon. */
  short: string
  /** Why it matters / what to do. Glossary page only. */
  long?: string
  learnMore?: string
  category: "setup" | "sending" | "audience" | "billing" | "automation"
}

// `as const satisfies` rather than a plain `: GlossaryEntry[]` annotation: it
// still type-checks every entry, but keeps each `id` as a string literal so
// `GlossaryTerm` below is a union and a typo in <Explain term="..."> fails to
// compile instead of silently rendering nothing.
//
// Kept private and re-exported widened as `GLOSSARY`: under `as const` the array
// type is a union of exact object shapes, so entries without `long`/`learnMore`
// don't merely have them undefined — the properties don't exist on the type at
// all, and `entry.long` fails to compile for consumers iterating the list.
const ENTRIES = [
  // ---------------------------------------------------------------- setup
  {
    id: "waba",
    term: "WhatsApp Business Account",
    aliases: ["WABA", "WABA ID", "WhatsApp Business Account ID"],
    short:
      "Meta's container for your WhatsApp business presence. It holds your phone numbers and your message templates.",
    long: "You get one when you connect through Facebook. It is not the same as your Facebook Page or your Business Manager — one Business Manager can hold several WhatsApp Business Accounts. The WABA ID is the long number Meta uses to identify it.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/overview",
    category: "setup",
  },
  {
    id: "phone-number-id",
    term: "Phone number ID",
    short:
      "Meta's internal ID for one of your WhatsApp numbers. It is not the phone number itself.",
    long: "Every number you register gets its own ID. Messages are sent from a phone number ID, so if you run more than one number, this is what decides which one a campaign goes out from.",
    category: "setup",
  },
  {
    id: "display-name",
    term: "Display name",
    short:
      "The business name people see at the top of the chat instead of your phone number.",
    long: "Meta reviews it before it goes live and can reject names that don't match your actual business. Changing it later means another review.",
    learnMore:
      "https://developers.facebook.com/docs/whatsapp/business-management-api/manage-phone-numbers",
    category: "setup",
  },
  {
    id: "business-verification",
    term: "Business verification",
    short:
      "Meta checking that your business is real, using documents like a registration certificate or utility bill.",
    long: "Until you're verified, your account stays on low sending limits. It normally takes 1-3 business days once you submit documents.",
    learnMore:
      "https://www.facebook.com/business/help/2058515294227817",
    category: "setup",
  },
  {
    id: "number-registration",
    term: "Number registration",
    short:
      "Activating a phone number on WhatsApp Business so it can send and receive. Requires a 6-digit code from Meta.",
    long: "A number can only belong to one WhatsApp Business Account at a time, and it can't already be in use on the consumer WhatsApp app. Nothing sends until registration completes.",
    category: "setup",
  },

  // -------------------------------------------------------------- sending
  {
    id: "quality-rating",
    term: "Quality rating",
    aliases: ["Quality", "Green", "Yellow", "Red", "Flagged"],
    short:
      "Meta's health score for one of your numbers, based on how people react to your messages — blocks and 'report' taps push it down.",
    long: "Green is healthy, yellow means at risk, red means flagged. A red number can have its daily limit cut, so the fix is always the same: message fewer people who didn't ask to hear from you, and make it obvious how to opt out.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/messaging-limits",
    category: "sending",
  },
  {
    id: "messaging-tier",
    term: "Messaging tier",
    aliases: ["Daily limit", "Messaging limit", "TIER_1K"],
    short:
      "How many different people your number is allowed to start a conversation with in a rolling 24 hours.",
    long: "New numbers usually start at 250 people per day and step up to 1,000, 10,000, 100,000 and finally unlimited. Meta raises it automatically when you send consistently and keep your quality rating healthy. Replying to people who messaged you first doesn't count against it.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/messaging-limits",
    category: "sending",
  },
  {
    id: "service-window",
    term: "24-hour window",
    aliases: ["Service window", "Session window", "Free-form window"],
    short:
      "For 24 hours after a customer messages you, you can reply with anything. After that you can only send an approved template.",
    long: "The clock restarts every time they message you again. This is why a closed window in the inbox switches you to template-only sending — it's a WhatsApp rule, not a limitation of this app.",
    learnMore:
      "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages",
    category: "sending",
  },
  {
    id: "template",
    term: "Message template",
    short:
      "A message you get approved by Meta in advance so you can send it to people who haven't messaged you recently.",
    long: "Templates can have blanks (variables) filled in per contact, like a name or an order number. You can't start a conversation without one.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/message-templates",
    category: "sending",
  },
  {
    id: "template-category",
    term: "Template category",
    aliases: ["Marketing", "Utility", "Authentication"],
    short:
      "Whether a template is marketing, utility (about something the customer already did, like an order) or authentication (a login code).",
    long: "The category sets the price and how strictly Meta reviews it. Meta can re-categorise a template on its own if the content doesn't match what you picked.",
    learnMore:
      "https://developers.facebook.com/docs/whatsapp/updates-to-pricing",
    category: "sending",
  },
  {
    id: "template-status",
    term: "Template status",
    aliases: ["Approved", "Pending", "Rejected"],
    short:
      "Where a template is in Meta's review. Only approved templates can be sent.",
    long: "Review usually finishes in minutes but can take up to 24 hours. Rejections are most often for promotional wording in a utility template, or placeholder text left in a variable.",
    category: "sending",
  },

  // ------------------------------------------------------------- audience
  {
    id: "opt-in",
    term: "Opt-in",
    short:
      "A person giving you permission to message them on WhatsApp, and your record of when and how they did.",
    long: "Meta requires this before you message anyone. Keeping the source (a website form, a checkout box, an in-store signup) matters if your number ever gets reviewed.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/overview/policy",
    category: "audience",
  },
  {
    id: "opt-out",
    term: "Opt-out",
    aliases: ["Unsubscribe", "Stop"],
    short:
      "A person asking you to stop messaging them. Opted-out contacts are excluded from every campaign automatically.",
    long: "You don't have to filter them out yourself — sending to someone who opted out is the fastest way to damage your quality rating.",
    category: "audience",
  },
  {
    id: "segment",
    term: "Segment",
    short:
      "A saved filter that picks out a group of contacts, like 'everyone in Mumbai who bought in the last 30 days'.",
    long: "Segments update themselves as contacts change, so a campaign sent to a segment always uses who matches today, not who matched when you built it.",
    category: "audience",
  },
  {
    id: "attribute",
    term: "Contact attribute",
    aliases: ["Custom field", "Attribute key"],
    short:
      "Any extra detail you store on a contact — city, plan, last order — that you can filter and personalise messages with.",
    category: "audience",
  },

  {
    id: "activity",
    term: "Conversation activity",
    short:
      "Whether a contact has messaged you, or you them, inside a period. Counted from real messages in the inbox — not from opens or clicks.",
    long:
      "\"Inactive for 30 days\" is the usual way to build a win-back audience. Note it counts the conversation, so your own reply keeps a contact active.",
    category: "audience",
  },
  {
    id: "campaign-behavior",
    term: "Campaign behaviour",
    short:
      "What a contact did with a broadcast: received it, read it, replied to it, or tapped a link in it.",
    long:
      "Link taps only exist for campaigns that tracked their links. A campaign that did not simply matches nobody on that condition — it is not an error, and it is not zero interest.",
    category: "audience",
  },

  // -------------------------------------------------------------- billing
  {
    id: "conversation",
    term: "Conversation",
    short:
      "The 24-hour thread with one person. Your wallet is charged per message Meta reports as billable, priced by the template's category and the contact's country.",
    long: "Two campaigns of the same size can cost different amounts, because a marketing template costs more than a utility one and a contact abroad costs more than one at home. Messages the contact starts — the free service window their reply opens — cost nothing, but that window does not make a template free: templates are priced separately from it.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/pricing",
    category: "billing",
  },
  {
    id: "wallet",
    term: "Wallet",
    short:
      "Your prepaid balance for our platform fee. Each billable message draws it down; when it hits zero, sending stops until you top up.",
    long: "There are no monthly plans or subscriptions here — you add money and it's spent as you send. Meta charges for the messages themselves separately, to the card on your WhatsApp Business account, so a send costs our fee from the wallet plus Meta's rate on that card.",
    category: "billing",
  },

  // ----------------------------------------------------------- automation
  {
    id: "automation",
    term: "Automation (rules)",
    short:
      "A rule: when something happens, do something. One trigger, optional filters, and the actions to run.",
    long: "Triggers include a keyword, a button tap, a new contact, a tag being added, or nobody replying for a while. Actions can reply, tag, set a field, hand the chat to a teammate, or call your systems — several in a row if you want. What it can't do is ask a question and branch on the answer; that's a Flow, and a rule can hand off to one.",
    category: "automation",
  },
  {
    id: "flow",
    term: "Chatbot flow",
    short:
      "A multi-step conversation you build visually, where the next message depends on what the person answers.",
    long: "The difference from an Automation: an Automation reacts to one event and runs a fixed list of actions, a Flow keeps the conversation going and branches on what the person answers. Start with an Automation; move to a Flow when you need to ask something.",
    category: "automation",
  },
  {
    id: "drip",
    term: "Drip sequence",
    short:
      "A series of messages sent on a schedule after someone joins it — day 0, day 2, day 7 — without waiting for a reply.",
    long: "Unlike a Flow, a drip is time-driven, not answer-driven. Good for onboarding and follow-ups.",
    category: "automation",
  },
  {
    id: "flow-session",
    term: "Flow session",
    aliases: ["session"],
    short:
      "One person's run through a chatbot flow: where they are in it, and what they have answered so far.",
    long: "A session stays open while the flow waits — for a reply, or for a wait step's timer. Only one can be open per contact at a time, so a second trigger while one is running does not start a parallel conversation.",
    category: "automation",
  },
  {
    id: "whatsapp-flow",
    term: "WhatsApp Flow (Meta form)",
    aliases: ["Flow form", "native flow"],
    short:
      "A form that opens inside WhatsApp — fields, dropdowns, a submit button. Built here, approved and hosted by Meta.",
    long: "Not the same thing as a chatbot flow, which is a conversation made of ordinary messages. A WhatsApp Flow is a screen: better for a booking or a sign-up with several fields, and it has its own lifecycle — draft, published, deprecated — because Meta holds the definition.",
    learnMore: "https://developers.facebook.com/docs/whatsapp/flows",
    category: "automation",
  },
  {
    id: "handoff",
    term: "Handoff to a human",
    short:
      "The point where a flow or rule stops answering and passes the conversation to your team.",
    long: "The contact keeps their place in the thread; what changes is who replies next. A handoff is what stops a chatbot from arguing with someone who needs a person.",
    category: "automation",
  },
  {
    id: "attribution",
    term: "Attribution",
    aliases: ["last touch", "last-touch"],
    short:
      "Which campaign, drip, flow or automation a sale is credited to. Last touch inside the account's window (7 days unless changed): the click if there was one, otherwise the send.",
    long: "It is a rule for assigning credit, not a measurement of cause — someone who would have bought anyway still counts against the last campaign they touched. The model used is stored on each sale, so historical numbers keep the rule they were credited under.",
    category: "billing",
  },
  {
    id: "api-key",
    term: "API key",
    short:
      "A secret your own systems use to call this platform — to report a sale, or send a message from your website.",
    long: "Shown once, when you create it, and never again: only a hash is stored. Losing it means creating a new one. Anyone holding it can act as your account, so treat it like a password and delete keys you no longer use.",
    category: "setup",
  },
] as const satisfies readonly GlossaryEntry[]

/** Slugs, for the `term` prop's type — a typo becomes a compile error. */
export type GlossaryTerm = (typeof ENTRIES)[number]["id"]

export const GLOSSARY: readonly GlossaryEntry[] = ENTRIES

const BY_ID = new Map<string, GlossaryEntry>(GLOSSARY.map((entry) => [entry.id, entry]))

export function getGlossaryEntry(id: GlossaryTerm): GlossaryEntry | undefined {
  return BY_ID.get(id)
}

export const CATEGORY_LABELS: Record<GlossaryEntry["category"], string> = {
  setup: "Getting set up",
  sending: "Sending messages",
  audience: "Contacts & audience",
  billing: "Cost & billing",
  automation: "Automation",
}
