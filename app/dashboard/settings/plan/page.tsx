"use client"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountId } from "@/hooks/use-account-id"
import {
  queryKeys,
  useEntitlementUsage,
  usePlanCatalog,
  useSubscription,
} from "@/hooks/use-queries"
import { formatMoney } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"
import { loadRazorpayCheckout } from "@/lib/razorpay"
import { startSubscriptionActivationWatch } from "@/lib/subscription-activation-watch"
import {
  cancelSubscription,
  changeSubscription,
  createSubscription,
  getCurrentUser,
  getSubscription,
  isServiceUnavailable,
  type BillingPeriod,
  type PlanCatalogEntry,
  type PlanTier,
} from "@/services/api"

const PERIODS: { value: BillingPeriod; label: string; note?: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly", note: "cheapest per month" },
]

const TIER_LABEL: Record<PlanTier, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
}

const TIER_BLURB: Record<PlanTier, string> = {
  starter: "Try the product for real, on one number.",
  growth: "Running campaigns and automations across a small team.",
  pro: "Multiple numbers, higher volume, priority support.",
}

const SUPPORT_LABEL: Record<string, string> = {
  self_serve: "Self-serve",
  priority_email: "Priority email",
  priority_dedicated: "Priority + dedicated",
}

/** The doc's per-month rate for a period (what the card headlines), derived from the actual per-cycle charge. */
function monthlyRate(entry: PlanCatalogEntry, period: BillingPeriod): number {
  const cycles = period === "monthly" ? 1 : period === "quarterly" ? 3 : 12
  return entry.pricing[period].amountUnits / cycles
}

function featureLines(entry: PlanCatalogEntry): string[] {
  const l = entry.limits
  return [
    `${l.numbers ?? "Unlimited"} WhatsApp ${l.numbers === 1 ? "number" : "numbers"}`,
    `${l.broadcastsPerMonth ?? "Unlimited"} broadcasts / month`,
    `${l.activeDrips ?? "Unlimited"} active drip sequences`,
    `${l.publishedFlows ?? "Unlimited"} published Flows`,
    `${l.aiDraftsPerMonth ?? "Unlimited"} AI template drafts / month`,
    l.api ? "API & webhooks" : "No API access",
    l.aiCalling ? "WhatsApp Calling" : "No calling",
    SUPPORT_LABEL[l.support] ?? l.support,
  ]
}

type Phase = "idle" | "starting" | "checkout" | "confirming" | "unavailable"

export default function PlanPage() {
  const { accountId, resolved } = useAccountId()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<BillingPeriod>("monthly")
  const [phase, setPhase] = useState<Phase>("idle")
  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const { data: catalog, isLoading: catalogLoading } = usePlanCatalog()
  const { data: usage } = useEntitlementUsage(accountId)
  const { data: subscription } = useSubscription(accountId)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.subscription(accountId ?? "") })
    queryClient.invalidateQueries({ queryKey: queryKeys.entitlementUsage(accountId ?? "") })
  }

  const busy = phase === "starting" || phase === "checkout" || phase === "confirming"
  const subscriptionLive = subscription?.status === "active" || subscription?.status === "halted"

  const subscribe = async (tier: PlanTier) => {
    if (!accountId || busy) return
    setInlineError(null)
    setPendingTier(tier)
    setPhase("starting")

    try {
      if (subscriptionLive) {
        // Decided 2026-10-10: no proration. Entitlements flip the moment this
        // call returns; Razorpay bills the new plan starting next cycle.
        await changeSubscription(accountId, tier, period)
        refresh()
        setPhase("idle")
        setPendingTier(null)
        return
      }

      const order = await createSubscription(accountId, tier, period)
      const Razorpay = await loadRazorpayCheckout()
      const user = getCurrentUser()
      const checkout = new Razorpay({
        key: order.keyId,
        subscription_id: order.subscriptionId,
        name: `Converszio ${TIER_LABEL[tier]}`,
        description: `${period[0].toUpperCase()}${period.slice(1)} subscription`,
        prefill: { name: user?.name ?? undefined, email: user?.email ?? undefined },
        handler: () => {
          // Gateway accepted the mandate. Entitlements have NOT changed yet —
          // only the subscription.activated webhook does that.
          setPhase("confirming")
          startSubscriptionActivationWatch(accountId, {
            fetchSubscription: () => getSubscription(accountId),
            onActivated: () => {
              refresh()
              setPhase("idle")
              setPendingTier(null)
            },
            onSlow: refresh,
            onGiveUp: refresh,
          })
        },
        modal: {
          ondismiss: () => {
            setPhase("idle")
            setPendingTier(null)
            setInlineError(
              "Checkout closed. If you completed the payment, your plan updates shortly."
            )
            refresh()
          },
        },
      })
      setPhase("checkout")
      checkout.open()
    } catch (err) {
      if (isServiceUnavailable(err)) {
        setPhase("unavailable")
        return
      }
      setPhase("idle")
      setPendingTier(null)
      setInlineError(getErrorMessage(err, "Couldn't start the subscription"))
    }
  }

  const cancel = async () => {
    if (!accountId) return
    setInlineError(null)
    try {
      await cancelSubscription(accountId)
      refresh()
    } catch (err) {
      setInlineError(getErrorMessage(err, "Couldn't cancel the subscription"))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Settings
          </Link>
        </Button>
        <PageHeader
          title="Plan & billing"
          description="Starter, Growth or Pro. Meta's own messaging charges are always separate and billed direct to your card."
        />
      </div>

      {resolved && !accountId ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={AlertTriangle}
              title="No connected account yet"
              description="Nothing to show until an account is linked."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {usage && subscription !== undefined && (
            <Alert>
              <AlertTitle>
                Current plan: {TIER_LABEL[usage.plan]}
                {subscription?.cancelAtCycleEnd && " — cancelling"}
              </AlertTitle>
              <AlertDescription>
                {subscription?.cancelAtCycleEnd && subscription.currentEnd
                  ? `Access continues until ${new Date(subscription.currentEnd).toLocaleDateString()}, then drops to Starter.`
                  : subscription?.status === "active"
                    ? `Billed ${formatMoney(subscription.amount, subscription.currency)} ${subscription.billingPeriod}. ${subscription.currentEnd ? `Next charge around ${new Date(subscription.currentEnd).toLocaleDateString()}.` : ""}`
                    : subscription?.status === "halted"
                      ? "Last payment failed and Razorpay is retrying — update your payment method to avoid losing access."
                      : "Free default — no subscription running."}
              </AlertDescription>
            </Alert>
          )}

          {inlineError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{inlineError}</AlertDescription>
            </Alert>
          )}

          {phase === "unavailable" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Payments aren&apos;t available right now</AlertTitle>
              <AlertDescription>
                The payment gateway isn&apos;t set up on this server yet. Your current plan is
                unaffected — contact support to enable billing.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={period} onValueChange={(v) => setPeriod(v as BillingPeriod)}>
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                  {p.note && <span className="ml-1.5 text-xs text-muted-foreground">({p.note})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {catalogLoading || !catalog ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-6">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {catalog.map((entry) => {
                const isFreeDefault = !subscriptionLive && usage?.plan === entry.tier
                const isCurrentPaid =
                  subscriptionLive &&
                  subscription?.tier === entry.tier &&
                  subscription?.billingPeriod === period
                const current = isFreeDefault || isCurrentPaid
                const actionLabel = subscriptionLive ? "Switch to this plan" : "Subscribe"
                const loadingThis = busy && pendingTier === entry.tier

                return (
                  <Card key={entry.tier} className={current ? "border-primary" : undefined}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{TIER_LABEL[entry.tier]}</CardTitle>
                        {current && <Badge>Current plan</Badge>}
                      </div>
                      <CardDescription>{TIER_BLURB[entry.tier]}</CardDescription>
                      <div className="pt-2">
                        <span className="text-3xl font-bold">
                          {formatMoney(monthlyRate(entry, period), "INR")}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo, ex-GST</span>
                        {period !== "monthly" && (
                          <p className="text-xs text-muted-foreground">
                            billed {formatMoney(entry.pricing[period].amountUnits, "INR")} {period}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5 text-sm">
                        {featureLines(entry).map((line) => (
                          <li key={line} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={current ? "outline" : "default"}
                        disabled={current || busy}
                        onClick={() => subscribe(entry.tier)}
                      >
                        {loadingThis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {current ? "Current plan" : actionLabel}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}

          {subscription?.status === "active" && !subscription.cancelAtCycleEnd && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cancel subscription</CardTitle>
                <CardDescription>
                  You keep {TIER_LABEL[subscription.tier]} until the period you&apos;ve already
                  paid for ends, then it drops to Starter. No refund for the current cycle.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Cancel subscription</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel {TIER_LABEL[subscription.tier]}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Access continues until{" "}
                        {subscription.currentEnd
                          ? new Date(subscription.currentEnd).toLocaleDateString()
                          : "the end of the current period"}
                        , then the account drops to Starter. This can&apos;t be undone from here —
                        you&apos;d need to subscribe again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={cancel}>Cancel subscription</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
