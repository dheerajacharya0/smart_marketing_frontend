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
  /** Razorpay order for a customer top-up. The wallet moves on the webhook, not here. */
  TOPUP_ORDER: `${API_BASE_URL}/billing/topup/order`,
  /** Payment history — every top-up order and its status. */
  TOPUP_ORDERS: (accountId: string, limit?: number) => {
    const query = new URLSearchParams({ accountId })
    if (limit != null) query.set("limit", String(Math.max(1, Math.trunc(limit))))
    return `${API_BASE_URL}/billing/topup/orders?${query.toString()}`
  },
  /** Admin-only: credits a wallet with no payment behind it. Refunds/reconciliation. */
  CREDIT: `${API_BASE_URL}/billing/credit`,
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

// Realtime chat socket — separate port from the REST API, raw ws:// (no
// Socket.IO). One connection is scoped to one accountId.
const CHAT_WS_PORT = env.NEXT_PUBLIC_CHAT_WS_PORT

function chatWsBase(): string {
  try {
    const apiUrl = new URL(API_BASE_URL)
    const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${apiUrl.hostname}:${CHAT_WS_PORT}`
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
  GET: (contactId: string, accountId: string) =>
    `${API_BASE_URL}/contacts/${contactId}?accountId=${accountId}`,
  UPDATE: (contactId: string) => `${API_BASE_URL}/contacts/${contactId}`,
  DELETE: (contactId: string, accountId: string) =>
    `${API_BASE_URL}/contacts/${contactId}?accountId=${accountId}`,
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
  CANCEL: (campaignId: string) => `${API_BASE_URL}/campaigns/${campaignId}/cancel`,
}

// Quality/health alerts endpoints (backend AlertsModule)
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
