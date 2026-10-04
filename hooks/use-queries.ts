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
  listContactTags,
  getWallet,
  getMetaSpend,
  getMetaPaymentStatus,
  getBillingEntries,
  getBillingUsage,
  getUnreadTotal,
  listAlerts,
  listTopupOrders,
  getSessionWindow,
  listWhatsappPhoneNumbers,
  listWhatsappTemplates,
  listInvoices,
  getTaxProfile,
  listApiKeys,
  listWebhookEndpoints,
  getWebhookDeliveries,
  listCampaigns,
  listCampaignSeries,
  listDrips,
  listFlows,
  listWhatsappFlows,
  listAutomationRules,
  getCampaign,
  getCampaignAnalytics,
  listCampaignRecipients,
  getSegment,
  listSegmentContacts,
  listDripEnrollments,
  getWhatsappFlow,
  getFlowKeyStatus,
  getLedgerSummary,
  getLedgerTimeseries,
  getLedgerBreakdown,
  getLedgerSettings,
  listStores,
  type LedgerBreakdownBy,
  type Campaign,
  type CampaignRecipientStatus,
  type ContactListFilters,
  type WhatsappTemplate,
  getFacebookAccountsCached,
  type FacebookAccount,
} from "@/services/api"

export const queryKeys = {
  segments: (accountId: string) => ["segments", accountId] as const,
  contacts: (accountId: string, filters?: ContactListFilters) =>
    ["contacts", accountId, filters ?? {}] as const,
  contact: (accountId: string, contactId: string) => ["contact", accountId, contactId] as const,
  contactAttributeKeys: (accountId: string) => ["contact-attribute-keys", accountId] as const,
  contactTags: (accountId: string) => ["contact-tags", accountId] as const,
  conversations: (accountId: string) => ["conversations", accountId] as const,
  unreadTotal: (accountId: string) => ["unread-total", accountId] as const,
  phoneNumbers: (accountId: string) => ["phone-numbers", accountId] as const,
  templates: (accountId: string, wabaId: string) => ["templates", accountId, wabaId] as const,
  wallet: (accountId: string) => ["wallet", accountId] as const,
  metaSpend: (accountId: string, from: string, to: string) => ["meta-spend", accountId, from, to] as const,
  ledger: (accountId: string) => ["ledger", accountId] as const,
  ledgerSummary: (accountId: string, from: string, to: string) =>
    ["ledger", accountId, "summary", from, to] as const,
  ledgerTimeseries: (accountId: string, from: string, to: string, tz: string) =>
    ["ledger", accountId, "timeseries", from, to, tz] as const,
  ledgerBreakdown: (accountId: string, by: LedgerBreakdownBy, from: string, to: string) =>
    ["ledger", accountId, "breakdown", by, from, to] as const,
  ledgerSettings: (accountId: string) => ["ledger", accountId, "settings"] as const,
  stores: (accountId: string) => ["stores", accountId] as const,
  metaPaymentStatus: (accountId: string) => ["meta-payment-status", accountId] as const,
  billingEntries: (accountId: string, limit: number, offset: number) =>
    ["billing-entries", accountId, limit, offset] as const,
  billingUsage: (accountId: string, from?: string, to?: string) =>
    ["billing-usage", accountId, from ?? null, to ?? null] as const,
  alerts: (accountId: string) => ["alerts", accountId] as const,
  topupOrders: (accountId: string) => ["topup-orders", accountId] as const,
  invoices: (accountId: string) => ["invoices", accountId] as const,
  taxProfile: (accountId: string) => ["tax-profile", accountId] as const,
  apiKeys: (accountId: string) => ["api-keys", accountId] as const,
  webhookEndpoints: (accountId: string) => ["webhook-endpoints", accountId] as const,
  webhookDeliveries: (accountId: string, endpointId: string, limit: number) =>
    ["webhook-deliveries", accountId, endpointId, limit] as const,
  campaigns: (accountId: string) => ["campaigns", accountId] as const,
  campaignSeries: (accountId: string) => ["campaign-series", accountId] as const,
  campaign: (accountId: string, campaignId: string) => ["campaign", accountId, campaignId] as const,
  campaignAnalytics: (accountId: string, campaignId: string, interval: string) =>
    ["campaign-analytics", accountId, campaignId, interval] as const,
  campaignRecipients: (
    accountId: string,
    campaignId: string,
    status: string,
    limit: number,
    offset: number,
  ) => ["campaign-recipients", accountId, campaignId, status, limit, offset] as const,
  segment: (accountId: string, segmentId: string) => ["segment", accountId, segmentId] as const,
  segmentContacts: (accountId: string, segmentId: string, limit: number, offset: number) =>
    ["segment-contacts", accountId, segmentId, limit, offset] as const,
  dripEnrollments: (
    accountId: string,
    dripId: string,
    status: string,
    limit: number,
    offset: number,
  ) => ["drip-enrollments", accountId, dripId, status, limit, offset] as const,
  drips: (accountId: string) => ["drips", accountId] as const,
  flows: (accountId: string) => ["flows", accountId] as const,
  whatsappFlows: (accountId: string) => ["whatsapp-flows", accountId] as const,
  whatsappFlow: (accountId: string, flowId: string) =>
    ["whatsapp-flow", accountId, flowId] as const,
  flowKeyStatus: (accountId: string, phoneNumberId: string) =>
    ["flow-key-status", accountId, phoneNumberId] as const,
  automationRules: (accountId: string) => ["automation-rules", accountId] as const,
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

/**
 * Rows per page on the contacts list. Lives here rather than in the page
 * because the nav prefetcher has to reproduce the page's first query key
 * exactly — a different page size is a different cache entry, and the prefetch
 * would warm a row the page never reads.
 */
export const CONTACTS_PAGE_SIZE = 20

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

/**
 * The signed-in user's unread badge total. Cheap and server-scoped, so the
 * sidebar doesn't have to load every conversation to render a number — and,
 * unlike summing the list client-side, it stays correct for an agent whose
 * conversation scope hides part of the inbox.
 *
 * Inbound messages arrive by webhook, so a short staleness window keeps every
 * route change from refiring it; the chat socket is what makes it feel live.
 */
export function useUnreadTotal(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.unreadTotal(accountId ?? ""),
    queryFn: () => getUnreadTotal(accountId as string),
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
 * Every tag on the account with its counts, most-used first. Tags change only
 * when someone edits a contact or a rule fires, so a minute of staleness beats
 * refetching it in every builder that opens.
 */
export function useContactTags(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.contactTags(accountId ?? ""),
    queryFn: () => listContactTags(accountId as string),
    enabled: Boolean(accountId),
    staleTime: 60 * 1000,
  })
}

/**
 * WhatsApp numbers linked to an account, registered or not. Meta only changes
 * these on an onboarding action or a quality webhook, so a minute of staleness
 * is fine and keeps route changes from refiring the Graph-backed call.
 */
/**
 * The accounts the signed-in user can reach — owned, or joined as a team
 * member (each carries its `role`). Rides the same short-lived promise cache
 * useAccountId resolves from, so it costs no extra request.
 */
export function useFacebookAccounts(enabled = true) {
  return useQuery({
    queryKey: ["facebook-accounts"] as const,
    queryFn: async () => {
      const res: unknown = await getFacebookAccountsCached()
      return (
        Array.isArray(res) ? res : ((res as { data?: unknown[] } | null)?.data ?? [])
      ) as FacebookAccount[]
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

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
  wabaId: string | null | undefined,
  {
    pollWhile,
    intervalMs = 10000,
  }: {
    /**
     * Given the last result, keep polling? Meta pushes template approvals by
     * webhook in the background, so the templates screen watches for a PENDING
     * row and stops once none are left.
     */
    pollWhile?: (templates: WhatsappTemplate[]) => boolean
    intervalMs?: number
  } = {},
) {
  return useQuery({
    queryKey: queryKeys.templates(accountId ?? "", wabaId ?? ""),
    queryFn: () => listWhatsappTemplates(accountId as string, wabaId as string),
    enabled: Boolean(accountId && wabaId),
    staleTime: 60 * 1000,
    refetchInterval: pollWhile
      ? (query) => (pollWhile(query.state.data ?? []) ? intervalMs : false)
      : false,
  })
}

/**
 * Whether Meta has a payment method for the account's WABA. Refetched when the
 * window regains focus: the customer adds the card in another tab, and the
 * checklist should tick over when they come back without a reload.
 */
export function useMetaPaymentStatus(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.metaPaymentStatus(accountId ?? ""),
    queryFn: () => getMetaPaymentStatus(accountId as string),
    enabled: Boolean(accountId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
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
 * Meta's charges for the range, per WABA. The server caches Meta's answer for
 * 15 minutes and Meta itself lags by hours, so refetching sooner is pointless.
 * Keyed on the day, not the instant: the dashboard's range ends at "now", and
 * a key that moved every render would refetch forever.
 */
export function useMetaSpend(accountId: string | null | undefined, from: Date, to: Date, enabled = true) {
  const fromDay = from.toISOString().slice(0, 10)
  const toDay = to.toISOString().slice(0, 10)
  return useQuery({
    queryKey: queryKeys.metaSpend(accountId ?? "", fromDay, toDay),
    queryFn: () => getMetaSpend(accountId as string, `${fromDay}T00:00:00.000Z`, `${toDay}T00:00:00.000Z`),
    enabled: Boolean(accountId) && enabled,
    staleTime: 15 * 60 * 1000,
  })
}

/**
 * Number-health alerts for an account — the full list, acknowledged included, so
 * the sidebar badge and the notifications page read the same cache entry and
 * can't disagree. Count unacknowledged client-side rather than refetching with
 * `unacknowledgedOnly`, which would be a second, divergent cache entry.
 */
/**
 * Quality alerts. `enabled` is for callers that know the user can't read them
 * — alerts are owner/admin only, and an agent's request is a guaranteed 403.
 */
export function useAlerts(accountId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.alerts(accountId ?? ""),
    queryFn: () => listAlerts(accountId as string),
    enabled: enabled && Boolean(accountId),
    // Alerts arrive from Meta webhooks, not user action; a minute of staleness
    // is fine and keeps every route change from refiring the request.
    staleTime: 60 * 1000,
  })
}

/**
 * Campaigns for an account.
 *
 * `refetchInterval` expresses the "poll while something is live" rule that the
 * campaigns page used to run as a `setInterval` next to a ref holding the
 * latest `hasActive`. Pass `pollWhileActive` and the polling stops on its own
 * when nothing is scheduled or running.
 */
/**
 * Repeating broadcasts. Polls while any is active, since a run turning into a
 * campaign is how the list changes; stops once none is.
 */
export function useCampaignSeries(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.campaignSeries(accountId ?? ""),
    queryFn: () => listCampaignSeries(accountId as string),
    enabled: Boolean(accountId),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((s) => s.status === "active") ? 30_000 : false,
  })
}

export function useCampaigns(
  accountId: string | null | undefined,
  {
    pollWhile,
    intervalMs = 5000,
  }: {
    /** Given the last result, should it keep polling? Omit for no polling. */
    pollWhile?: (campaigns: Campaign[]) => boolean
    intervalMs?: number
  } = {},
) {
  return useQuery({
    queryKey: queryKeys.campaigns(accountId ?? ""),
    queryFn: () => listCampaigns(accountId as string),
    enabled: Boolean(accountId),
    // The predicate is re-evaluated against the latest result, so polling stops
    // by itself when the last campaign finishes. The page previously did this
    // with a setInterval plus a ref, because the interval's closure would
    // otherwise keep testing the `hasActive` it was created with.
    refetchInterval: pollWhile
      ? (query) => (pollWhile(query.state.data ?? []) ? intervalMs : false)
      : false,
  })
}

/**
 * One campaign. Polls while it is scheduled or running, on the same
 * `pollWhile` shape as the list — the detail page had its own setInterval and
 * its own ref for the same reason, and now has neither.
 */
export function useCampaign(
  accountId: string | null | undefined,
  campaignId: string | null | undefined,
  {
    pollWhile,
    intervalMs = 5000,
  }: { pollWhile?: (campaign: Campaign | undefined) => boolean; intervalMs?: number } = {},
) {
  return useQuery({
    queryKey: queryKeys.campaign(accountId ?? "", campaignId ?? ""),
    queryFn: () => getCampaign(campaignId as string, accountId as string),
    enabled: Boolean(accountId && campaignId),
    refetchInterval: pollWhile
      ? (query) => (pollWhile(query.state.data) ? intervalMs : false)
      : false,
  })
}

/**
 * A campaign's analytics. Separate query from the campaign itself because it
 * fails separately: the page kept a `.catch(() => null)` around this one so a
 * missing analytics block never took the campaign down with it, and two queries
 * express that without the catch.
 */
export function useCampaignAnalytics(
  accountId: string | null | undefined,
  campaignId: string | null | undefined,
  interval: "hour" | "day" | null,
  { refetchIntervalMs }: { refetchIntervalMs?: number | false } = {},
) {
  return useQuery({
    queryKey: queryKeys.campaignAnalytics(accountId ?? "", campaignId ?? "", interval ?? "day"),
    queryFn: () => getCampaignAnalytics(campaignId as string, accountId as string, interval ?? "day"),
    enabled: Boolean(accountId && campaignId && interval),
    refetchInterval: refetchIntervalMs ?? false,
  })
}

/** A page of a campaign's recipients, filtered by delivery status. */
export function useCampaignRecipients(
  accountId: string | null | undefined,
  campaignId: string | null | undefined,
  params: { status?: CampaignRecipientStatus; limit: number; offset: number },
  { refetchIntervalMs }: { refetchIntervalMs?: number | false } = {},
) {
  return useQuery({
    queryKey: queryKeys.campaignRecipients(
      accountId ?? "",
      campaignId ?? "",
      params.status ?? "all",
      params.limit,
      params.offset,
    ),
    queryFn: () =>
      listCampaignRecipients(campaignId as string, accountId as string, {
        ...(params.status ? { status: params.status } : {}),
        limit: params.limit,
        offset: params.offset,
      }),
    enabled: Boolean(accountId && campaignId),
    refetchInterval: refetchIntervalMs ?? false,
  })
}

/** One segment, with its rules. */
export function useSegment(
  accountId: string | null | undefined,
  segmentId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.segment(accountId ?? "", segmentId ?? ""),
    queryFn: () => getSegment(segmentId as string, accountId as string),
    enabled: Boolean(accountId && segmentId),
  })
}

/**
 * A page of a segment's members.
 *
 * On a dynamic segment this is a sample the server picked, not a stored list;
 * on a static one it is the membership. Add and remove write to the static one,
 * so a mutation invalidates every page rather than patching the current one —
 * removing a row shifts every page after it.
 */
export function useSegmentContacts(
  accountId: string | null | undefined,
  segmentId: string | null | undefined,
  params: { limit: number; offset: number },
) {
  return useQuery({
    queryKey: queryKeys.segmentContacts(
      accountId ?? "",
      segmentId ?? "",
      params.limit,
      params.offset,
    ),
    queryFn: () =>
      listSegmentContacts(segmentId as string, accountId as string, params.limit, params.offset),
    enabled: Boolean(accountId && segmentId),
  })
}

/** A page of a sequence's enrolments, filtered by status. */
export function useDripEnrollments(
  accountId: string | null | undefined,
  dripId: string | null | undefined,
  params: { status?: string; limit: number; offset: number },
) {
  return useQuery({
    queryKey: queryKeys.dripEnrollments(
      accountId ?? "",
      dripId ?? "",
      params.status ?? "all",
      params.limit,
      params.offset,
    ),
    queryFn: () =>
      listDripEnrollments(dripId as string, accountId as string, {
        ...(params.status ? { status: params.status as never } : {}),
        limit: params.limit,
        offset: params.offset,
      }),
    enabled: Boolean(accountId && dripId),
  })
}

/** Drip sequences for an account. */
export function useDrips(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.drips(accountId ?? ""),
    queryFn: () => listDrips(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Chatbot flows — ours, not Meta's forms. */
export function useFlows(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.flows(accountId ?? ""),
    queryFn: () => listFlows(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Meta WhatsApp Flows — the native forms, a different product from `useFlows`. */
export function useWhatsappFlows(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.whatsappFlows(accountId ?? ""),
    queryFn: () => listWhatsappFlows(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** One Meta form, with its definition. */
export function useWhatsappFlow(
  accountId: string | null | undefined,
  flowId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.whatsappFlow(accountId ?? "", flowId ?? ""),
    queryFn: () => getWhatsappFlow(flowId as string, accountId as string),
    enabled: Boolean(accountId && flowId),
  })
}

/**
 * Whether an endpoint keypair is configured for this number.
 *
 * `enabled` is the caller's call, because only a `data_api` form needs a
 * keypair: asking for every form would put an alarming "not configured" panel
 * on one that never calls out.
 */
export function useFlowKeyStatus(
  accountId: string | null | undefined,
  phoneNumberId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.flowKeyStatus(accountId ?? "", phoneNumberId ?? ""),
    queryFn: () => getFlowKeyStatus(accountId as string, phoneNumberId as string),
    enabled: enabled && Boolean(accountId && phoneNumberId),
  })
}

/** Automation rules, in the priority order the backend evaluates them. */
export function useAutomationRules(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.automationRules(accountId ?? ""),
    queryFn: () => listAutomationRules(accountId as string),
    enabled: Boolean(accountId),
  })
}

/**
 * Tax invoices for settled top-ups.
 *
 * Migrated off a hand-rolled `useState + fetch` that caught its failure into
 * `setInvoices([])`, so a dropped request rendered "No invoices yet". Through
 * `useQuery`, `error` and an empty `data` are separate values and cannot be
 * confused for each other — which is the actual reason to migrate a fetch here,
 * ahead of caching or dedup.
 */
export function useInvoices(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices(accountId ?? ""),
    queryFn: () => listInvoices(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Invoicing details — legal name, GSTIN, and the tax a top-up will attract. */
export function useTaxProfile(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.taxProfile(accountId ?? ""),
    queryFn: () => getTaxProfile(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** API keys for calling this account from the customer's own systems. */
export function useApiKeys(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.apiKeys(accountId ?? ""),
    queryFn: () => listApiKeys(accountId as string),
    enabled: Boolean(accountId),
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

/**
 * Spend per feature over a window. `from`/`to` are ISO strings and part of the
 * cache key, so a range change is a separate entry rather than a silent refetch
 * of the same one.
 */
export function useBillingUsage(
  accountId: string | null | undefined,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: queryKeys.billingUsage(accountId ?? "", from, to),
    queryFn: () => getBillingUsage(accountId as string, from, to),
    enabled: Boolean(accountId),
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

/** Outbound webhook endpoints registered on an account. */
export function useWebhookEndpoints(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.webhookEndpoints(accountId ?? ""),
    queryFn: () => listWebhookEndpoints(accountId as string),
    enabled: Boolean(accountId),
  })
}

/**
 * Delivery attempts for one endpoint. Only fetched while the drawer showing
 * them is open — `endpointId` is null the rest of the time.
 *
 * Deliveries move without user action (a queued attempt retries on its own
 * schedule), so this refetches on focus rather than serving a cache that
 * silently ages while someone watches it for a retry to land.
 */
export function useWebhookDeliveries(
  accountId: string | null | undefined,
  endpointId: string | null | undefined,
  limit = 20
) {
  return useQuery({
    queryKey: queryKeys.webhookDeliveries(accountId ?? "", endpointId ?? "", limit),
    queryFn: () => getWebhookDeliveries(endpointId as string, accountId as string, limit),
    enabled: Boolean(accountId && endpointId),
    staleTime: 10 * 1000,
  })
}

/*
 * The revenue ledger. Every key starts ["ledger", accountId], so recording or
 * voiding a sale refreshes all of it with one
 * `invalidateQueries({ queryKey: queryKeys.ledger(accountId) })`.
 */

export function useLedgerSummary(accountId: string | null | undefined, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.ledgerSummary(accountId ?? "", from, to),
    queryFn: () => getLedgerSummary(accountId as string, from, to),
    enabled: Boolean(accountId),
  })
}

export function useLedgerTimeseries(
  accountId: string | null | undefined,
  from: string,
  to: string,
  tz: string
) {
  return useQuery({
    queryKey: queryKeys.ledgerTimeseries(accountId ?? "", from, to, tz),
    queryFn: () => getLedgerTimeseries(accountId as string, from, to, tz),
    enabled: Boolean(accountId),
  })
}

export function useLedgerSources(accountId: string | null | undefined, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.ledgerBreakdown(accountId ?? "", "source", from, to),
    queryFn: () => getLedgerBreakdown(accountId as string, "source", from, to),
    enabled: Boolean(accountId),
  })
}

export function useLedgerSenders(
  accountId: string | null | undefined,
  from: string,
  to: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.ledgerBreakdown(accountId ?? "", "sender", from, to),
    queryFn: () => getLedgerBreakdown(accountId as string, "sender", from, to),
    enabled: Boolean(accountId) && enabled,
  })
}

export function useLedgerCustomers(
  accountId: string | null | undefined,
  from: string,
  to: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.ledgerBreakdown(accountId ?? "", "customer", from, to),
    queryFn: () => getLedgerBreakdown(accountId as string, "customer", from, to),
    enabled: Boolean(accountId) && enabled,
  })
}

export function useLedgerSettings(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.ledgerSettings(accountId ?? ""),
    queryFn: () => getLedgerSettings(accountId as string),
    enabled: Boolean(accountId),
  })
}

/**
 * Connected stores. Polls every 5s while any store is still pulling in its
 * history, so the order count visibly climbs, and stops once all are done.
 */
export function useStores(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.stores(accountId ?? ""),
    queryFn: () => listStores(accountId as string),
    enabled: Boolean(accountId),
    refetchInterval: (query) =>
      query.state.data?.stores.some(
        (s) => s.status === "syncing" || s.backfillStatus === "pending" || s.backfillStatus === "running"
      )
        ? 5000
        : false,
  })
}
