/**
 * API Configuration
 *
 * This file contains all API endpoints used in the application.
 * Replace these dummy URLs with your actual API endpoints when ready.
 */

import { env } from "@/lib/env"

// Base API URL — validated at boot (lib/env.ts). Required in production; falls
// back to localhost only in development.
export const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL

// Auth endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  SIGNUP: `${API_BASE_URL}/auth/signup`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh-token`,
  FACEBOOK_LOGIN_URL: `${API_BASE_URL}/auth/facebook/login-url`,
  FACEBOOK_CALLBACK: `${API_BASE_URL}/auth/facebook/callback`,
  FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
  RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
  VERIFY_EMAIL: `${API_BASE_URL}/auth/verify-email`,
  RESEND_VERIFICATION: `${API_BASE_URL}/auth/resend-verification`,
  // Meta Embedded Signup — backend exchanges the popup `code` for a WABA+phone.
  EMBEDDED_SIGNUP: `${API_BASE_URL}/auth/facebook/embedded-signup`,
}

// Prepaid wallet / billing. accountId is the Facebook account's `id` (UUID —
// the backend 400s a malformed one rather than 500ing).
export const BILLING_ENDPOINTS = {
  WALLET: (accountId: string) => `${API_BASE_URL}/billing/wallet?accountId=${accountId}`,
  // limit is capped at 200 server-side; clamp here so a caller's bad page size
  // is a smaller page, not a 400 the user has to decode.
  ENTRIES: (accountId: string, limit = 50, offset = 0) =>
    `${API_BASE_URL}/billing/entries?accountId=${accountId}&limit=${Math.min(
      Math.max(1, Math.trunc(limit)),
      200
    )}&offset=${Math.max(0, Math.trunc(offset))}`,
  /**
   * Spend grouped by the feature that caused it. Debits only — credits have no
   * source. `from`/`to` are ISO-8601; the backend 400s anything else, so pass
   * `Date#toISOString()` output rather than a locale string.
   */
  USAGE: (accountId: string, from?: string, to?: string) => {
    const query = new URLSearchParams({ accountId })
    if (from) query.set("from", from)
    if (to) query.set("to", to)
    return `${API_BASE_URL}/billing/usage?${query.toString()}`
  },
  /** Razorpay order for a customer top-up. The wallet moves on the webhook, not here. */
  TOPUP_ORDER: `${API_BASE_URL}/billing/topup/order`,
  /** Payment history — every top-up order and its status. */
  TOPUP_ORDERS: (accountId: string, limit?: number) => {
    const query = new URLSearchParams({ accountId })
    if (limit != null) query.set("limit", String(Math.max(1, Math.trunc(limit))))
    return `${API_BASE_URL}/billing/topup/orders?${query.toString()}`
  },
  /**
   * What a broadcast would cost, before the campaign exists. A pure read — no
   * wallet entry, no reservation, no funds held. Audience params mirror campaign
   * creation: `audienceTag` and `segmentId` are mutually exclusive, and sending
   * neither prices every opted-in contact.
   */
  ESTIMATE: (params: {
    accountId: string
    templateName: string
    templateLanguage?: string
    audienceTag?: string
    segmentId?: string
  }) => {
    const query = new URLSearchParams({
      accountId: params.accountId,
      templateName: params.templateName,
    })
    if (params.templateLanguage) query.set("templateLanguage", params.templateLanguage)
    if (params.audienceTag) query.set("audienceTag", params.audienceTag)
    if (params.segmentId) query.set("segmentId", params.segmentId)
    return `${API_BASE_URL}/billing/estimate?${query.toString()}`
  },
  /** Admin-only: credits a wallet with no payment behind it. Refunds/reconciliation. */
  CREDIT: `${API_BASE_URL}/billing/credit`,
  /** The customer's invoicing details, and the tax a top-up will attract. */
  TAX_PROFILE: (accountId: string) => `${API_BASE_URL}/billing/tax-profile?accountId=${accountId}`,
  SET_TAX_PROFILE: `${API_BASE_URL}/billing/tax-profile`,
  /** Issued invoices only — an unpaid top-up has no invoice number. */
  INVOICES: (accountId: string, limit?: number) => {
    const query = new URLSearchParams({ accountId })
    if (limit != null) query.set("limit", String(limit))
    return `${API_BASE_URL}/billing/invoices?${query.toString()}`
  },
  INVOICE: (topupId: string, accountId: string) =>
    `${API_BASE_URL}/billing/invoices/${topupId}?accountId=${accountId}`,
  /** Readable by the account owner; both writes below are admin-only (403 otherwise). */
  MARKUP: (accountId: string) => `${API_BASE_URL}/billing/markup?accountId=${accountId}`,
  SET_MARKUP: `${API_BASE_URL}/billing/markup`,
  SET_GLOBAL_MARKUP: `${API_BASE_URL}/billing/markup/global`,
}

// Facebook endpoints
export const FACEBOOK_ENDPOINTS = {
  // The backend derives the user from the session cookie on every route below.
  // A client-supplied userId is both redundant and the IDOR that was closed —
  // the DTOs now reject unknown properties with a 400, so it must not be sent.
  GET_ACCOUNTS: () => `${API_BASE_URL}/auth/facebook-accounts`,
  GET_BUSINESS_MANAGERS: (accountId: string) =>
    `${API_BASE_URL}/business/facebook?accountId=${accountId}`,
  SET_BUSINESS_DETAILS: `${API_BASE_URL}/business/facebook-business-details`,
  GET_WHATSAPP_BUSINESS_ACCOUNT: (accountId: string) => `${API_BASE_URL}/business/whatsapp-business-accounts?accountId=${accountId}`,
  SYNC_BUSINESS: (accountId?: string) =>
    `${API_BASE_URL}/business/sync${accountId ? `?accountId=${accountId}` : ""}`,
}

// WhatsApp Cloud API endpoints
export const WHATSAPP_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/whatsapp/register`,
  SUBSCRIBE: `${API_BASE_URL}/whatsapp/subscribe`,
  SEND: `${API_BASE_URL}/whatsapp/send`,
  // Is the 24-hour customer-service window open for this recipient? Gate the
  // free-form composer on this instead of letting the send 400 with 131047.
  SESSION_WINDOW: (accountId: string, phoneNumberId: string, to: string) =>
    `${API_BASE_URL}/whatsapp/session-window?${new URLSearchParams({
      accountId,
      phoneNumberId,
      to,
    }).toString()}`,
  SEND_TEMPLATE: `${API_BASE_URL}/whatsapp/send-template`,
  TEMPLATES: `${API_BASE_URL}/whatsapp/templates`,
  GENERATE_TEMPLATE: `${API_BASE_URL}/whatsapp/templates/generate`,
  LIST_TEMPLATES: (accountId: string, wabaId: string) =>
    `${API_BASE_URL}/whatsapp/templates?accountId=${accountId}&wabaId=${wabaId}`,
  UPDATE_TEMPLATE: (templateId: string) => `${API_BASE_URL}/whatsapp/templates/${templateId}`,
  DELETE_TEMPLATE: (name: string, accountId: string, wabaId: string) =>
    `${API_BASE_URL}/whatsapp/templates/${name}?accountId=${accountId}&wabaId=${wabaId}`,
  /**
   * multipart/form-data upload → a Cloud API media id, valid for 30 days.
   * The only way to get an id for `send-media` or a template header without
   * hosting the file publicly first.
   */
  UPLOAD_MEDIA: `${API_BASE_URL}/whatsapp/media`,
  SEND_MEDIA: `${API_BASE_URL}/whatsapp/send-media`,
  SEND_INTERACTIVE: `${API_BASE_URL}/whatsapp/send-interactive`,
  MEDIA_METADATA: (mediaId: string, accountId: string) =>
    `${API_BASE_URL}/whatsapp/media/${mediaId}?accountId=${accountId}`,
  MEDIA_DOWNLOAD: (mediaId: string, accountId: string) =>
    `${API_BASE_URL}/whatsapp/media/${mediaId}/download?accountId=${accountId}`,
  ADD_PHONE_NUMBER: `${API_BASE_URL}/whatsapp/phone-numbers`,
  LIST_PHONE_NUMBERS: (accountId: string) => `${API_BASE_URL}/whatsapp/phone-numbers?accountId=${accountId}`,
  REQUEST_CODE: `${API_BASE_URL}/whatsapp/request-code`,
  VERIFY_CODE: `${API_BASE_URL}/whatsapp/verify-code`,
  EVENTS: (accountId: string, wabaId?: string, phoneNumberId?: string) => {
    const params = new URLSearchParams({ accountId })
    if (wabaId) params.set("wabaId", wabaId)
    if (phoneNumberId) params.set("phoneNumberId", phoneNumberId)
    return `${API_BASE_URL}/whatsapp/events?${params.toString()}`
  },
  CONVERSATIONAL_AUTOMATION: (accountId: string, phoneNumberId: string) =>
    `${API_BASE_URL}/whatsapp/conversational-automation?accountId=${accountId}&phoneNumberId=${phoneNumberId}`,
}

// Realtime chat socket — a second server on its own port, raw ws:// (no
// Socket.IO). One connection is scoped to one accountId.
const CHAT_WS_PORT = env.NEXT_PUBLIC_CHAT_WS_PORT
const CHAT_WS_URL_OVERRIDE = env.NEXT_PUBLIC_CHAT_WS_URL

/**
 * Normalises the override to a bare origin, because `/ws` is appended below.
 *
 * Two corrections rather than a rejection, since both mistakes are near-certain
 * and neither is visible when it happens — a wrong socket URL shows up as an
 * inbox that silently stops updating, with a working REST API next to it:
 *
 * - a trailing `/ws`, because the deploy notes quote the full socket URL and
 *   pasting it whole would otherwise produce `/ws/ws`;
 * - an `http(s)://` scheme, because it is copied from the API URL next to it and
 *   `new WebSocket("https://…")` throws.
 */
function normaliseWsOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "").replace(/\/ws$/, "")
  return trimmed.replace(/^http(s?):\/\//, "ws$1://")
}

function chatWsBase(): string {
  // An explicit origin always wins — the escape hatch for a realtime server that
  // genuinely lives somewhere else.
  if (CHAT_WS_URL_OVERRIDE) return normaliseWsOrigin(CHAT_WS_URL_OVERRIDE)

  try {
    const apiUrl = new URL(API_BASE_URL)

    // An https API means the backend is behind TLS, and TLS means something is
    // terminating in front of it — a proxy, a tunnel, a load balancer, a PaaS.
    // Every one of those publishes ONE origin and routes the realtime server by
    // path, because they route a single port per service. So the socket is on
    // that same origin, and appending :3002 to it reaches nothing: the port is
    // not published, and the connection does not get refused, it hangs until the
    // browser gives up with ERR_CONNECTION_TIMED_OUT.
    //
    // `.host`, not `.hostname`, so a non-default port in the API URL is kept.
    if (apiUrl.protocol === "https:") return `wss://${apiUrl.host}`

    // Plain http is the local shape, where the two servers really are two ports
    // on one machine and nothing sits in front of them.
    return `ws://${apiUrl.hostname}:${CHAT_WS_PORT}`
  } catch {
    return `ws://localhost:${CHAT_WS_PORT}`
  }
}

// No token in the URL — the httpOnly access_token cookie authenticates the
// handshake (Phase 4). accountId stays as a query param; it is not a secret.
export const CHAT_WS_URL = (accountId: string) =>
  `${chatWsBase()}/ws?accountId=${encodeURIComponent(accountId)}`

// Chat inbox endpoints
export const CHAT_ENDPOINTS = {
  LIST_CONVERSATIONS: (
    accountId: string,
    filters?: { assigneeId?: string; unassigned?: boolean; label?: string }
  ) => {
    const params = new URLSearchParams({ accountId })
    // unassigned wins over assigneeId server-side, so don't send both
    if (filters?.unassigned) params.set("unassigned", "true")
    else if (filters?.assigneeId) params.set("assigneeId", filters.assigneeId)
    if (filters?.label) params.set("label", filters.label)
    return `${API_BASE_URL}/chat/conversations?${params.toString()}`
  },
  LIST_MESSAGES: (conversationId: string, accountId: string, before?: string, limit?: number) => {
    const params = new URLSearchParams({ accountId })
    if (before) params.set("before", before)
    if (limit != null) params.set("limit", String(limit))
    return `${API_BASE_URL}/chat/conversations/${conversationId}/messages?${params.toString()}`
  },
  /**
   * Inbox badge total for the signed-in user. Built on the same list the inbox
   * renders, so an agent with a restricted conversation scope can't carry a
   * badge counting threads they aren't allowed to open.
   */
  UNREAD_TOTAL: (accountId: string) =>
    `${API_BASE_URL}/chat/conversations/unread?accountId=${accountId}`,
  MARK_READ: (conversationId: string, accountId: string) =>
    `${API_BASE_URL}/chat/conversations/${conversationId}/read?accountId=${accountId}`,
  ASSIGN: (conversationId: string) => `${API_BASE_URL}/chat/conversations/${conversationId}/assign`,
  UNASSIGN: (conversationId: string) => `${API_BASE_URL}/chat/conversations/${conversationId}/unassign`,
  ADD_LABEL: (conversationId: string) => `${API_BASE_URL}/chat/conversations/${conversationId}/labels`,
  REMOVE_LABEL: (conversationId: string, label: string, accountId: string) =>
    `${API_BASE_URL}/chat/conversations/${conversationId}/labels/${encodeURIComponent(label)}?accountId=${accountId}`,
  LIST_NOTES: (conversationId: string, accountId: string) =>
    `${API_BASE_URL}/chat/conversations/${conversationId}/notes?accountId=${accountId}`,
  ADD_NOTE: (conversationId: string) => `${API_BASE_URL}/chat/conversations/${conversationId}/notes`,
  DELETE_NOTE: (conversationId: string, noteId: string, accountId: string) =>
    `${API_BASE_URL}/chat/conversations/${conversationId}/notes/${noteId}?accountId=${accountId}`,
}

// Team management endpoints
export const TEAM_ENDPOINTS = {
  LIST_MEMBERS: (accountId: string) => `${API_BASE_URL}/team/members?accountId=${accountId}`,
  ADD_MEMBER: `${API_BASE_URL}/team/members`,
  UPDATE_MEMBER: (memberId: string) => `${API_BASE_URL}/team/members/${memberId}`,
  DELETE_MEMBER: (memberId: string, accountId: string) =>
    `${API_BASE_URL}/team/members/${memberId}?accountId=${accountId}`,
  /** Invite by email, whether or not that address has an account here yet. */
  CREATE_INVITE: `${API_BASE_URL}/team/invites`,
  LIST_INVITES: (accountId: string) => `${API_BASE_URL}/team/invites?accountId=${accountId}`,
  REVOKE_INVITE: (inviteId: string, accountId: string) =>
    `${API_BASE_URL}/team/invites/${inviteId}?accountId=${accountId}`,
  /** Redeemed by the signed-in user — the token identifies the invite, not a person. */
  ACCEPT_INVITE: `${API_BASE_URL}/team/invites/accept`,
}

// Contacts (CRM) endpoints
export const CONTACTS_ENDPOINTS = {
  LIST: (params: {
    accountId: string
    tag?: string
    search?: string
    optedIn?: boolean
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams({ accountId: params.accountId })
    if (params.tag) query.set("tag", params.tag)
    if (params.search) query.set("search", params.search)
    if (params.optedIn != null) query.set("optedIn", String(params.optedIn))
    if (params.limit != null) query.set("limit", String(params.limit))
    if (params.offset != null) query.set("offset", String(params.offset))
    return `${API_BASE_URL}/contacts?${query.toString()}`
  },
  CREATE: `${API_BASE_URL}/contacts`,
  ATTRIBUTE_KEYS: (accountId: string) =>
    `${API_BASE_URL}/contacts/attribute-keys?accountId=${accountId}`,
  /**
   * Every distinct tag on the account with its contact counts — a real
   * server-side aggregate, not the tags that happen to be on a page of
   * contacts. Sorted by usage, most-used first.
   */
  TAGS: (accountId: string) => `${API_BASE_URL}/contacts/tags?accountId=${accountId}`,
  GET: (contactId: string, accountId: string) =>
    `${API_BASE_URL}/contacts/${contactId}?accountId=${accountId}`,
  UPDATE: (contactId: string) => `${API_BASE_URL}/contacts/${contactId}`,
  DELETE: (contactId: string, accountId: string) =>
    `${API_BASE_URL}/contacts/${contactId}?accountId=${accountId}`,
  /**
   * Campaign sends and drip enrolments for one contact, newest first — the
   * reverse index nothing else provides. `total` counts across both kinds.
   */
  ACTIVITY: (contactId: string, accountId: string, limit?: number, offset?: number) => {
    const query = new URLSearchParams({ accountId })
    if (limit != null) query.set("limit", String(limit))
    if (offset != null) query.set("offset", String(offset))
    return `${API_BASE_URL}/contacts/${contactId}/activity?${query.toString()}`
  },
  OPT_IN: (contactId: string) => `${API_BASE_URL}/contacts/${contactId}/opt-in`,
  OPT_OUT: (contactId: string) => `${API_BASE_URL}/contacts/${contactId}/opt-out`,
  IMPORT: `${API_BASE_URL}/contacts/import`,
}

// Chatbot flows endpoints
// Drip sequences endpoints
export const DRIPS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/drips`,
  LIST: (accountId: string) => `${API_BASE_URL}/drips?accountId=${accountId}`,
  GET: (dripId: string, accountId: string) => `${API_BASE_URL}/drips/${dripId}?accountId=${accountId}`,
  UPDATE: (dripId: string) => `${API_BASE_URL}/drips/${dripId}`,
  DELETE: (dripId: string, accountId: string) => `${API_BASE_URL}/drips/${dripId}?accountId=${accountId}`,
  ENROLL: (dripId: string) => `${API_BASE_URL}/drips/${dripId}/enroll`,
  ENROLLMENTS: (params: {
    dripId: string
    accountId: string
    status?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams({ accountId: params.accountId })
    if (params.status) query.set("status", params.status)
    if (params.limit != null) query.set("limit", String(params.limit))
    if (params.offset != null) query.set("offset", String(params.offset))
    return `${API_BASE_URL}/drips/${params.dripId}/enrollments?${query.toString()}`
  },
  CANCEL_ENROLLMENT: (dripId: string, enrollmentId: string) =>
    `${API_BASE_URL}/drips/${dripId}/enrollments/${enrollmentId}/cancel`,
}

export const FLOWS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/flows`,
  LIST: (accountId: string) => `${API_BASE_URL}/flows?accountId=${accountId}`,
  GET: (flowId: string, accountId: string) => `${API_BASE_URL}/flows/${flowId}?accountId=${accountId}`,
  UPDATE: (flowId: string) => `${API_BASE_URL}/flows/${flowId}`,
  DELETE: (flowId: string, accountId: string) =>
    `${API_BASE_URL}/flows/${flowId}?accountId=${accountId}`,
  SESSIONS: (params: {
    flowId: string
    accountId: string
    status?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams({ accountId: params.accountId })
    if (params.status) query.set("status", params.status)
    if (params.limit != null) query.set("limit", String(params.limit))
    if (params.offset != null) query.set("offset", String(params.offset))
    return `${API_BASE_URL}/flows/${params.flowId}/sessions?${query.toString()}`
  },
}

// Segments (audience rules) endpoints
export const SEGMENTS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/segments`,
  LIST: (accountId: string) => `${API_BASE_URL}/segments?accountId=${accountId}`,
  GET: (segmentId: string, accountId: string) =>
    `${API_BASE_URL}/segments/${segmentId}?accountId=${accountId}`,
  CONTACTS: (segmentId: string, accountId: string, limit?: number, offset?: number) => {
    const query = new URLSearchParams({ accountId })
    if (limit != null) query.set("limit", String(limit))
    if (offset != null) query.set("offset", String(offset))
    return `${API_BASE_URL}/segments/${segmentId}/contacts?${query.toString()}`
  },
  UPDATE: (segmentId: string) => `${API_BASE_URL}/segments/${segmentId}`,
  DELETE: (segmentId: string, accountId: string) =>
    `${API_BASE_URL}/segments/${segmentId}?accountId=${accountId}`,
  PREVIEW: `${API_BASE_URL}/segments/preview`,
  /** Static segments only — rejected on a dynamic one. Idempotent. */
  ADD_MEMBERS: (segmentId: string) => `${API_BASE_URL}/segments/${segmentId}/members`,
  /** POST, not DELETE: ids go in the body, and DELETE-with-body is unreliable through proxies. */
  REMOVE_MEMBERS: (segmentId: string) => `${API_BASE_URL}/segments/${segmentId}/members/remove`,
}

// Analytics endpoints
export const ANALYTICS_ENDPOINTS = {
  OVERVIEW: (accountId: string, from?: string, to?: string) => {
    const query = new URLSearchParams({ accountId })
    if (from) query.set("from", from)
    if (to) query.set("to", to)
    return `${API_BASE_URL}/analytics/overview?${query.toString()}`
  },
  CAMPAIGN: (campaignId: string, accountId: string, interval?: "hour" | "day") => {
    const query = new URLSearchParams({ accountId })
    if (interval) query.set("interval", interval)
    return `${API_BASE_URL}/analytics/campaigns/${campaignId}?${query.toString()}`
  },
  MESSAGING: (accountId: string, from?: string, to?: string, interval?: "hour" | "day") => {
    const query = new URLSearchParams({ accountId })
    if (from) query.set("from", from)
    if (to) query.set("to", to)
    if (interval) query.set("interval", interval)
    return `${API_BASE_URL}/analytics/messaging?${query.toString()}`
  },
}

// Broadcast campaign endpoints
export const CAMPAIGNS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/campaigns`,
  LIST: (accountId: string) => `${API_BASE_URL}/campaigns?accountId=${accountId}`,
  GET: (campaignId: string, accountId: string) =>
    `${API_BASE_URL}/campaigns/${campaignId}?accountId=${accountId}`,
  RECIPIENTS: (params: {
    campaignId: string
    accountId: string
    status?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams({ accountId: params.accountId })
    if (params.status) query.set("status", params.status)
    if (params.limit != null) query.set("limit", String(params.limit))
    if (params.offset != null) query.set("offset", String(params.offset))
    return `${API_BASE_URL}/campaigns/${params.campaignId}/recipients?${query.toString()}`
  },
  /** Reversible stop — recipients stay `pending`. Only from `scheduled`/`running`. */
  PAUSE: (campaignId: string) => `${API_BASE_URL}/campaigns/${campaignId}/pause`,
  /** Back to `running` if it had started, else `scheduled`. Only from `paused`. */
  RESUME: (campaignId: string) => `${API_BASE_URL}/campaigns/${campaignId}/resume`,
  CANCEL: (campaignId: string) => `${API_BASE_URL}/campaigns/${campaignId}/cancel`,
}

// Quality/health alerts endpoints (backend AlertsModule)
/**
 * Tracked short links. The public `/r/:token` redirect is what counts a click;
 * it isn't called from here, only handed to recipients inside messages.
 */
export const LINKS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/links`,
  LIST: (accountId: string, limit = 50, offset = 0) =>
    `${API_BASE_URL}/links?accountId=${accountId}&limit=${Math.min(
      Math.max(1, Math.trunc(limit)),
      200
    )}&offset=${Math.max(0, Math.trunc(offset))}`,
}

/**
 * Sales reported against a contact, so messaging can be measured in money.
 * We can't derive these — we don't sell the customer's products and Meta
 * reports nothing about them — so revenue only exists here if their store or
 * CRM posts it.
 */
export const CONVERSIONS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/conversions`,
  LIST: (params: {
    accountId: string
    campaignId?: string
    waId?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams({ accountId: params.accountId })
    if (params.campaignId) query.set("campaignId", params.campaignId)
    if (params.waId) query.set("waId", params.waId)
    if (params.from) query.set("from", params.from)
    if (params.to) query.set("to", params.to)
    if (params.limit != null) query.set("limit", String(params.limit))
    if (params.offset != null) query.set("offset", String(params.offset))
    return `${API_BASE_URL}/conversions?${query.toString()}`
  },
  /** A refund is a void, never a delete — a total that silently drops rows can't be reconciled. */
  VOID: (conversionId: string) => `${API_BASE_URL}/conversions/${conversionId}/void`,
}

/** Customer-facing API keys: mint, list, per-endpoint usage, revoke. */
export const API_KEYS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/api-keys`,
  LIST: (accountId: string) => `${API_BASE_URL}/api-keys?accountId=${accountId}`,
  USAGE: (accountId: string, from?: string, to?: string, limit?: number) => {
    const query = new URLSearchParams({ accountId })
    if (from) query.set("from", from)
    if (to) query.set("to", to)
    if (limit != null) query.set("limit", String(limit))
    return `${API_BASE_URL}/api-keys/usage?${query.toString()}`
  },
  /** Revoke, not delete — the key's usage history has to outlive it. */
  REVOKE: (keyId: string, accountId: string) =>
    `${API_BASE_URL}/api-keys/${keyId}?accountId=${accountId}`,
}

export const ALERTS_ENDPOINTS = {
  LIST: (accountId: string, unacknowledgedOnly?: boolean) => {
    const query = new URLSearchParams({ accountId })
    if (unacknowledgedOnly) query.set("unacknowledged", "true")
    return `${API_BASE_URL}/alerts?${query.toString()}`
  },
  ACK: (alertId: string, accountId: string) =>
    `${API_BASE_URL}/alerts/${alertId}/ack?accountId=${accountId}`,
}

// Automation rules endpoints
export const AUTOMATION_ENDPOINTS = {
  CREATE_RULE: `${API_BASE_URL}/automation/rules`,
  LIST_RULES: (accountId: string) => `${API_BASE_URL}/automation/rules?accountId=${accountId}`,
  UPDATE_RULE: (ruleId: string) => `${API_BASE_URL}/automation/rules/${ruleId}`,
  DELETE_RULE: (ruleId: string, accountId: string) =>
    `${API_BASE_URL}/automation/rules/${ruleId}?accountId=${accountId}`,
}

/**
 * Meta **WhatsApp Flows**: forms rendered inside the WhatsApp client from JSON
 * registered with Meta.
 *
 * Not to be confused with `FLOWS_ENDPOINTS` above, which is our own chatbot
 * engine driving a conversation through ordinary messages. Different product,
 * different lifecycle, deliberately separate.
 */
export const WHATSAPP_FLOWS_ENDPOINTS = {
  CREATE: `${API_BASE_URL}/whatsapp-flows`,
  LIST: (accountId: string) => `${API_BASE_URL}/whatsapp-flows?accountId=${accountId}`,
  GET: (flowId: string, accountId: string) =>
    `${API_BASE_URL}/whatsapp-flows/${flowId}?accountId=${accountId}`,
  /** Rejected once the flow is published — Meta freezes the JSON at that point. */
  UPLOAD_DEFINITION: (flowId: string) =>
    `${API_BASE_URL}/whatsapp-flows/${flowId}/definition`,
  PUBLISH: (flowId: string) => `${API_BASE_URL}/whatsapp-flows/${flowId}/publish`,
  DEPRECATE: (flowId: string) => `${API_BASE_URL}/whatsapp-flows/${flowId}/deprecate`,
  /** Re-read status from Meta: it throttles or blocks a flow without a webhook. */
  SYNC: (flowId: string) => `${API_BASE_URL}/whatsapp-flows/${flowId}/sync`,
  DELETE: (flowId: string, accountId: string) =>
    `${API_BASE_URL}/whatsapp-flows/${flowId}?accountId=${accountId}`,
  SEND: `${API_BASE_URL}/whatsapp-flows/send`,
  RESPONSES: (params: {
    accountId: string
    metaFlowId?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams({ accountId: params.accountId })
    if (params.metaFlowId) query.set("metaFlowId", params.metaFlowId)
    if (params.limit != null) query.set("limit", String(params.limit))
    if (params.offset != null) query.set("offset", String(params.offset))
    return `${API_BASE_URL}/whatsapp-flows/responses?${query.toString()}`
  },
  /** Endpoint (data_api) encryption keys, per phone number. */
  KEY_STATUS: (accountId: string, phoneNumberId: string) =>
    `${API_BASE_URL}/whatsapp-flows/keys/status?accountId=${accountId}&phoneNumberId=${phoneNumberId}`,
  ROTATE_KEY: `${API_BASE_URL}/whatsapp-flows/keys`,
}

/**
 * **Outbound** webhooks: endpoints the customer registers with us, which we
 * POST message events to.
 *
 * Not to be confused with Meta's inbound webhook, which points the other way —
 * the backend route is `/webhook-endpoints` rather than `/webhooks` for exactly
 * that reason, and the names here keep the distinction.
 *
 * JWT only on the backend, never an API key: a key that could re-point an
 * endpoint would let one leaked credential silently redirect every future event.
 */
export const WEBHOOK_ENDPOINTS = {
  /** The response carries the signing secret — the only time it is readable. */
  CREATE: `${API_BASE_URL}/webhook-endpoints`,
  LIST: (accountId: string) => `${API_BASE_URL}/webhook-endpoints?accountId=${accountId}`,
  UPDATE: (endpointId: string) => `${API_BASE_URL}/webhook-endpoints/${endpointId}`,
  DELETE: (endpointId: string, accountId: string) =>
    `${API_BASE_URL}/webhook-endpoints/${endpointId}?accountId=${accountId}`,
  /** Attempt history: status, response code and last error per event. */
  DELIVERIES: (endpointId: string, accountId: string, limit?: number, offset?: number) => {
    const query = new URLSearchParams({ accountId })
    if (limit != null) query.set("limit", String(limit))
    if (offset != null) query.set("offset", String(offset))
    return `${API_BASE_URL}/webhook-endpoints/${endpointId}/deliveries?${query.toString()}`
  },
}
