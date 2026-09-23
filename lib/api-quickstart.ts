import { CONVERSIONS_ENDPOINTS, WHATSAPP_ENDPOINTS } from "@/config/api-config"

/**
 * A runnable first request for a freshly minted API key.
 *
 * A key was issued with nowhere to learn what to do with it: no base URL, no
 * auth header, no example. `app/dashboard/docs/page.tsx` explains why the old
 * API Reference tab has deliberately not come back — a hand-written endpoint
 * list here would be a second source of truth against the backend and would
 * start rotting the day it shipped.
 *
 * So this is not a reference. It is three requests, built from the same
 * `config/api-config.ts` builders the dashboard itself calls, with the viewer's
 * own `accountId` and `phoneNumberId` substituted in. A backend path change
 * moves these snippets for free, and the ids are real, so a copied command runs
 * rather than needing to be filled in first.
 *
 * Only two controllers accept a key (`whatsapp/*` and `conversions/*`);
 * contacts, campaigns, segments, links and analytics are JWT-only. Listing what
 * a key *can't* reach is part of the job — the keys card previously advertised
 * "syncing contacts", which no key can do.
 */

/** Stand-in for the secret. The real key is readable only once, at creation. */
export const KEY_PLACEHOLDER = "wsk_YOUR_KEY"

/** Header the guard reads. `Authorization: Bearer wsk_…` also works, but one way is enough to document. */
export const KEY_HEADER = "x-api-key"

export interface QuickstartExample {
  id: string
  title: string
  /** Why you'd call it, in the caller's terms — not a restatement of the path. */
  purpose: string
  method: "GET" | "POST"
  url: string
  /** Pretty-printed for reading; the curl carries it minified. */
  body?: unknown
  /** One line, so it pastes into any shell — bash, PowerShell or cmd. */
  curl: string
  /** Shown under the snippet when there's something non-obvious about the call. */
  note?: string
}

export interface QuickstartInput {
  accountId: string
  /**
   * The sender. Absent when no number has been registered yet, in which case
   * the send examples are omitted rather than shown with a fake id — a snippet
   * that 400s teaches the wrong lesson about the key.
   */
  phoneNumberId?: string | null
  /** Where to send the example message. The viewer's own number is the only safe default. */
  to?: string | null
}

/** Shell-safe single quoting: `'` becomes `'\''`, the only escape sh allows inside quotes. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function curlFor(method: "GET" | "POST", url: string, body?: unknown): string {
  const parts = [`curl -X ${method} ${shellQuote(url)}`, `-H ${shellQuote(`${KEY_HEADER}: ${KEY_PLACEHOLDER}`)}`]
  if (body !== undefined) {
    parts.push(`-H 'Content-Type: application/json'`)
    parts.push(`-d ${shellQuote(JSON.stringify(body))}`)
  }
  return parts.join(" ")
}

/** Placeholder recipient, used when the account has no number of its own to echo back. */
const SAMPLE_TO = "+919000000000"

export function buildQuickstart({ accountId, phoneNumberId, to }: QuickstartInput): QuickstartExample[] {
  const examples: QuickstartExample[] = []
  const recipient = to || SAMPLE_TO

  if (phoneNumberId) {
    const sendBody = {
      accountId,
      phoneNumberId,
      to: recipient,
      message: "Hello from the API",
    }
    examples.push({
      id: "send",
      title: "Send a message",
      purpose: "Reply inside an open 24-hour window — an order update, a support answer.",
      method: "POST",
      url: WHATSAPP_ENDPOINTS.SEND,
      body: sendBody,
      curl: curlFor("POST", WHATSAPP_ENDPOINTS.SEND, sendBody),
      note: "Only works while the contact has messaged you in the last 24 hours. Outside that window WhatsApp accepts templates only, so this returns an error and the next example is what you want.",
    })

    const templateBody = {
      accountId,
      phoneNumberId,
      to: recipient,
      templateName: "your_approved_template",
      languageCode: "en",
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "Priya" }],
        },
      ],
    }
    examples.push({
      id: "send-template",
      title: "Send an approved template",
      purpose: "Start a conversation, or message someone who hasn't written recently.",
      method: "POST",
      url: WHATSAPP_ENDPOINTS.SEND_TEMPLATE,
      body: templateBody,
      curl: curlFor("POST", WHATSAPP_ENDPOINTS.SEND_TEMPLATE, templateBody),
      note: "Replace templateName with one Meta has approved, and drop components if your template has no variables.",
    })
  }

  const saleBody = {
    accountId,
    waId: recipient,
    value: 499.5,
    externalId: "order-1041",
  }
  examples.push({
    id: "conversion",
    title: "Report a sale",
    purpose: "Tell us an order happened, so revenue lands against the campaign that earned it.",
    method: "POST",
    url: CONVERSIONS_ENDPOINTS.CREATE,
    body: saleBody,
    curl: curlFor("POST", CONVERSIONS_ENDPOINTS.CREATE, saleBody),
    note: "value is in whole currency units (499.50, not paise). externalId is your own order id — send it and a retried webhook can't double the revenue.",
  })

  return examples
}

/** What a key reaches, and what it doesn't. The second half is the part people get wrong. */
export const KEY_SCOPE = {
  allowed: [
    "Send text, template, media and interactive messages",
    "Check what happened to a sent message, and whether a 24-hour window is open",
    "Report, list and void sales",
    "Register a number and set its greeting or command menu",
  ],
  denied: [
    "Contacts, campaigns, segments and tracked links",
    "Creating or editing message templates",
    "Analytics, billing, and managing API keys themselves",
  ],
} as const
