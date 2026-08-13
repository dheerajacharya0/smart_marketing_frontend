"use client"

/**
 * Typed TanStack Query hooks (Phase A.1) wrapping the typed API layer.
 *
 * These are the migration target for pages still hand-rolling `useState + fetch`.
 * Each hook keys on the resource + account so results dedup and cache across the
 * app. Add one per read as you migrate a page; mutations use `useMutation` with
 * `queryClient.invalidateQueries` to refresh affected lists.
 */
import { useQuery } from "@tanstack/react-query"
import {
  listSegments,
  listContacts,
  getContact,
  getChatConversations,
  getContactAttributeKeys,
  getWallet,
  getBillingEntries,
  listAlerts,
  listTopupOrders,
  getSessionWindow,
  listWhatsappPhoneNumbers,
  listWhatsappTemplates,
  type ContactListFilters,
} from "@/services/api"

export const queryKeys = {
  segments: (accountId: string) => ["segments", accountId] as const,
  contacts: (accountId: string, filters?: ContactListFilters) =>
    ["contacts", accountId, filters ?? {}] as const,
  contact: (accountId: string, contactId: string) => ["contact", accountId, contactId] as const,
  contactAttributeKeys: (accountId: string) => ["contact-attribute-keys", accountId] as const,
  conversations: (accountId: string) => ["conversations", accountId] as const,
  phoneNumbers: (accountId: string) => ["phone-numbers", accountId] as const,
  templates: (accountId: string, wabaId: string) => ["templates", accountId, wabaId] as const,
  wallet: (accountId: string) => ["wallet", accountId] as const,
  billingEntries: (accountId: string, limit: number, offset: number) =>
    ["billing-entries", accountId, limit, offset] as const,
  alerts: (accountId: string) => ["alerts", accountId] as const,
  topupOrders: (accountId: string) => ["topup-orders", accountId] as const,
  sessionWindow: (accountId: string, phoneNumberId: string, to: string) =>
    ["session-window", accountId, phoneNumberId, to] as const,
}

/** Live segment list for an account. Disabled until an accountId is known. */
export function useSegments(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.segments(accountId ?? ""),
    queryFn: () => listSegments(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Paginated/filtered contacts for an account. */
export function useContacts(accountId: string | null | undefined, filters?: ContactListFilters) {
  return useQuery({
    queryKey: queryKeys.contacts(accountId ?? "", filters),
    queryFn: () => listContacts(accountId as string, filters),
    enabled: Boolean(accountId),
  })
}

/**
 * A single contact. A 404 here means "no such contact on this account", which
 * no amount of retrying fixes, so retry is off — the profile page renders its
 * not-found state immediately instead of spinning through the default backoff.
 */
export function useContact(
  accountId: string | null | undefined,
  contactId: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.contact(accountId ?? "", contactId ?? ""),
    queryFn: () => getContact(contactId as string, accountId as string),
    enabled: Boolean(accountId && contactId),
    retry: false,
  })
}

/**
 * Every conversation on the account. The contact profile uses this to find the
 * one thread belonging to a contact — there is no conversation-by-waId endpoint,
 * so the match happens client-side on `contactWaId`.
 *
 * Deliberately not the `useWhatsappConversations` hook the inbox uses: that one
 * opens a chat websocket and tracks the active phone-number context, neither of
 * which a read-only profile view needs.
 */
export function useConversations(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.conversations(accountId ?? ""),
    queryFn: () => getChatConversations(accountId as string),
    enabled: Boolean(accountId),
    staleTime: 30 * 1000,
  })
}

/** Distinct custom-attribute keys (server-side DISTINCT). */
export function useContactAttributeKeys(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.contactAttributeKeys(accountId ?? ""),
    queryFn: () => getContactAttributeKeys(accountId as string),
    enabled: Boolean(accountId),
  })
}

/**
 * WhatsApp numbers linked to an account, registered or not. Meta only changes
 * these on an onboarding action or a quality webhook, so a minute of staleness
 * is fine and keeps route changes from refiring the Graph-backed call.
 */
export function useWhatsappPhoneNumbers(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.phoneNumbers(accountId ?? ""),
    queryFn: () => listWhatsappPhoneNumbers(accountId as string),
    enabled: Boolean(accountId),
    staleTime: 60 * 1000,
  })
}

/**
 * Message templates for one WABA. Approval is decided by Meta's review queue
 * (minutes to hours), so this is cached the same as the number list rather than
 * refetched per mount.
 */
export function useWhatsappTemplates(
  accountId: string | null | undefined,
  wabaId: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.templates(accountId ?? "", wabaId ?? ""),
    queryFn: () => listWhatsappTemplates(accountId as string, wabaId as string),
    enabled: Boolean(accountId && wabaId),
    staleTime: 60 * 1000,
  })
}

/** Prepaid wallet balance. Debits lag a send by a few seconds (webhook delay). */
export function useWallet(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet(accountId ?? ""),
    queryFn: () => getWallet(accountId as string),
    enabled: Boolean(accountId),
  })
}

/**
 * Number-health alerts for an account — the full list, acknowledged included, so
 * the sidebar badge and the notifications page read the same cache entry and
 * can't disagree. Count unacknowledged client-side rather than refetching with
 * `unacknowledgedOnly`, which would be a second, divergent cache entry.
 */
export function useAlerts(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.alerts(accountId ?? ""),
    queryFn: () => listAlerts(accountId as string),
    enabled: Boolean(accountId),
    // Alerts arrive from Meta webhooks, not user action; a minute of staleness
    // is fine and keeps every route change from refiring the request.
    staleTime: 60 * 1000,
  })
}

/** Razorpay top-up orders — payment history for the billing page. */
export function useTopupOrders(accountId: string | null | undefined, limit = 20) {
  return useQuery({
    queryKey: queryKeys.topupOrders(accountId ?? ""),
    queryFn: () => listTopupOrders(accountId as string, limit),
    enabled: Boolean(accountId),
  })
}

/**
 * Is the recipient's 24-hour service window open? Gates the free-form composer:
 * outside the window Meta only accepts approved templates, and a send would come
 * back 400/131047. The window closes on a wall clock, so this goes stale fast —
 * 30s, and it refetches when the tab regains focus.
 */
export function useSessionWindow(
  accountId: string | null | undefined,
  phoneNumberId: string | null | undefined,
  to: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.sessionWindow(accountId ?? "", phoneNumberId ?? "", to ?? ""),
    queryFn: () => getSessionWindow(accountId as string, phoneNumberId as string, to as string),
    enabled: Boolean(accountId && phoneNumberId && to),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })
}

/** Paginated statement, newest first. */
export function useBillingEntries(
  accountId: string | null | undefined,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: queryKeys.billingEntries(accountId ?? "", limit, offset),
    queryFn: () => getBillingEntries(accountId as string, limit, offset),
    enabled: Boolean(accountId),
  })
}
