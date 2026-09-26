"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import {
  confirmMetaPayment,
  getAnalyticsOverview,
  getFacebookAccountsCached,
  type AnalyticsOverview,
  type FacebookAccount,
} from "@/services/api"
import {
  useContacts,
  useMetaPaymentStatus,
  useWallet,
  useWhatsappPhoneNumbers,
  useWhatsappTemplates,
  queryKeys,
} from "@/hooks/use-queries"

export interface SetupStep {
  id: string
  title: string
  /** Plain-language "why this matters", written for someone new to WhatsApp API. */
  description: string
  done: boolean
  /** Where the CTA goes. Absent when the action isn't a navigation (step 1). */
  href?: string
  /** The CTA leaves the app (Meta's own settings) — opens in a new tab. */
  external?: boolean
  /**
   * A second, in-app action beside the CTA — for a step whose completion we can
   * only learn from the user (they did it on Meta's site, before we have any
   * evidence of our own).
   */
  secondary?: { label: string; onClick: () => void; pending: boolean }
  cta: string
  /**
   * The step can't be started yet because an earlier one isn't done (e.g. you
   * can't submit a template before a WABA exists). The UI dims these rather than
   * offering a link that dead-ends.
   */
  blocked: boolean
}

/**
 * Earliest plausible date for this product — used as the `from` bound so the
 * "have you ever sent a message" check is lifetime-wide, not last-7-days. The
 * analytics endpoint requires an explicit range; without one it defaults to a
 * recent window and a long-idle account would be told to send its first message
 * again.
 */
const ALL_TIME_FROM = "2020-01-01T00:00:00.000Z"

const DISMISS_KEY = "setupChecklistDismissed"

/**
 * Drives the first-run setup checklist: the path from an empty account to a
 * first sent message. Every step reads a real backend signal — nothing here is
 * stored client-side, so the checklist is correct on a new device and can't
 * drift from the account's actual state.
 *
 * Dismissal is the one exception: it's a local UI preference, not account state.
 */
export function useSetupChecklist(accountId: string | null | undefined) {
  const phoneNumbers = useWhatsappPhoneNumbers(accountId)
  const contacts = useContacts(accountId, { limit: 1 })
  const wallet = useWallet(accountId)
  const payment = useMetaPaymentStatus(accountId)
  const queryClient = useQueryClient()
  // Destructured, not the whole result: `mutate` is referentially stable, while
  // the result object is new every render and would rebuild `steps` each time.
  const { mutate: confirmPayment, isPending: confirmPending } = useMutation({
    mutationFn: () => confirmMetaPayment(accountId as string),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.metaPaymentStatus(accountId ?? ""), status)
    },
    // Without this the button just re-enables and the click looks ignored.
    onError: (error) => {
      toast.error(`Couldn't save that — ${getErrorMessage(error)}. Try again in a moment.`)
    },
  })

  // Templates live under a WABA, which only exists once a number is linked.
  const wabaId = phoneNumbers.data?.[0]?.wabaId ?? null
  const templates = useWhatsappTemplates(accountId, wabaId)

  const overview = useQuery({
    queryKey: ["analytics-overview-lifetime", accountId ?? ""] as const,
    queryFn: () =>
      getAnalyticsOverview(accountId as string, ALL_TIME_FROM, new Date().toISOString()),
    enabled: Boolean(accountId),
    staleTime: 60 * 1000,
  })

  // Same cached list useAccountId resolved from, so this costs no request.
  const accounts = useQuery({
    queryKey: ["facebook-accounts"] as const,
    queryFn: async () => {
      const res: unknown = await getFacebookAccountsCached()
      return (
        Array.isArray(res) ? res : ((res as { data?: unknown[] } | null)?.data ?? [])
      ) as FacebookAccount[]
    },
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
  })
  // The card at Meta is the owner's to add — a teammate can't reach the
  // owner's WhatsApp Business billing, so the step is only noise to them.
  const isOwner =
    (accounts.data?.find((a) => a.id === accountId)?.role ?? "owner") === "owner"

  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1")
    setMounted(true)
  }, [])

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }, [])

  const connected = Boolean(accountId)
  const hasRegisteredNumber = (phoneNumbers.data ?? []).some((n) => n.status === "registered")
  const hasContacts = (contacts.data?.total ?? 0) > 0
  const hasApprovedTemplate = (templates.data ?? []).some(
    (t) => String(t.status ?? "").toUpperCase() === "APPROVED"
  )
  const hasBalance = (wallet.data?.balance ?? 0) > 0
  // Done only on a definite yes. An account whose wallet already pays Meta
  // (a partner credit line) has nothing to add at Meta, so it is done too.
  const hasMetaPayment =
    payment.data?.hasPaymentMethod === true || wallet.data?.metaBilling === "partner"
  // Meta rejected a message for a payment problem, newer than any success.
  const paymentFailed = payment.data?.hasPaymentMethod === false
  const hasSent = ((overview.data as AnalyticsOverview | undefined)?.messaging.outbound ?? 0) > 0

  const allSteps: SetupStep[] = useMemo(
    () => [
      {
        id: "connect",
        title: "Connect WhatsApp",
        description:
          "Link your Facebook Business account so we can send and receive messages on your behalf.",
        done: connected,
        cta: "Connect",
        blocked: false,
      },
      {
        id: "number",
        title: "Register a phone number",
        description:
          "Your business number has to be verified with Meta before it can send anything.",
        done: hasRegisteredNumber,
        href: "/dashboard/whatsapp",
        cta: "Set up number",
        blocked: !connected,
      },
      {
        id: "contacts",
        title: "Add your contacts",
        description:
          "Import a CSV or add people one at a time. You can only message contacts who opted in.",
        done: hasContacts,
        href: "/dashboard/contacts",
        cta: "Add contacts",
        blocked: !connected,
      },
      {
        id: "template",
        title: "Get a template approved",
        description:
          "To start a conversation, Meta requires a pre-approved message template. Review usually takes minutes.",
        done: hasApprovedTemplate,
        href: wabaId ? `/dashboard/whatsapp/${wabaId}/templates` : "/dashboard/whatsapp",
        cta: "Create template",
        blocked: !wabaId,
      },
      {
        id: "meta-payment",
        title: "Add a payment method at Meta",
        description: paymentFailed
          ? "Meta rejected a message because of a payment problem on your WhatsApp Business account. Check the card in Meta's billing settings."
          : "Meta bills your messages directly, to a card on your WhatsApp Business account. Until one is added, Meta rejects every template you send.",
        done: hasMetaPayment,
        href: "https://business.facebook.com/billing_hub/accounts",
        external: true,
        cta: "Open Meta billing",
        blocked: !wabaId,
        // Meta won't tell us about the card directly; until a message proves it
        // either way, the customer's word is the only signal there is.
        secondary: paymentFailed
          ? undefined
          : {
              label: "I've added it",
              onClick: () => confirmPayment(),
              pending: confirmPending,
            },
      },
      {
        id: "wallet",
        title: "Add wallet balance",
        description:
          "Our platform fee is prepaid, per message sent — top up before your first broadcast.",
        done: hasBalance,
        href: "/dashboard/billing",
        cta: "Top up",
        blocked: !connected,
      },
      {
        id: "send",
        title: "Send your first message",
        description:
          "Reply to someone in the inbox, or run a campaign to your contacts. This is the finish line.",
        done: hasSent,
        href: "/dashboard/campaigns",
        cta: "Send a campaign",
        blocked: !hasRegisteredNumber,
      },
    ],
    [
      connected,
      hasRegisteredNumber,
      hasContacts,
      hasApprovedTemplate,
      hasMetaPayment,
      paymentFailed,
      confirmPayment,
      confirmPending,
      hasBalance,
      hasSent,
      wabaId,
    ]
  )
  const steps = useMemo(
    () => (isOwner ? allSteps : allSteps.filter((s) => s.id !== "meta-payment")),
    [allSteps, isOwner]
  )

  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length

  // Only the checks that can actually run count as loading — templates stay
  // `isLoading` forever while disabled (no WABA yet), which would otherwise pin
  // the card in a skeleton for exactly the accounts that need it most.
  const loading =
    Boolean(accountId) &&
    (phoneNumbers.isLoading ||
      contacts.isLoading ||
      wallet.isLoading ||
      accounts.isLoading ||
      (Boolean(wabaId) && payment.isLoading) ||
      overview.isLoading ||
      (Boolean(wabaId) && templates.isLoading))

  return {
    steps,
    completed,
    total: steps.length,
    allDone,
    loading,
    /** Hide entirely: dismissed by the user, or every step is done. */
    hidden: !mounted || dismissed || allDone,
    dismiss,
  }
}
