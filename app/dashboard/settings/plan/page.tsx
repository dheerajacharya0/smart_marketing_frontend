"use client"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, Check, Gift, Loader2, Minus, Sparkles } from "lucide-react"
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
import { SubscriptionInvoicesTable } from "@/components/billing/subscription-invoices-table"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountId } from "@/hooks/use-account-id"
import {
  queryKeys,
  useEntitlementUsage,
  useLaunchDealStatus,
  useNumberAddon,
  usePlanCatalog,
  useSubscription,
} from "@/hooks/use-queries"
import { formatMoney } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"
import { loadRazorpayCheckout } from "@/lib/razorpay"
import { startSubscriptionActivationWatch } from "@/lib/subscription-activation-watch"
import {
  cancelNumberAddon,
  cancelSubscription,
  changeSubscription,
  createSubscription,
  getCurrentUser,
  getNumberAddon,
  getSubscription,
  isServiceUnavailable,
  purchaseNumberAddon,
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
  growth: "Everything in Starter, plus running campaigns and automations across a small team.",
  pro: "Everything in Growth, plus multiple numbers, higher volume, priority support.",
}

const SUPPORT_LABEL: Record<string, string> = {
  self_serve: "Self-serve",
  priority_email: "Priority email",
  priority_dedicated: "Priority chat + onboarding call",
}

/** True on every tier — shown at the top of every card, not sourced from `limits` since it isn't per-tier data. */
const UNIVERSAL_BENEFITS = ["Unlimited team seats", "0% markup on Meta messages"]

const CYCLES: Record<BillingPeriod, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** The doc's per-month rate for a period (what the card headlines), derived from the actual per-cycle charge. Ex-GST. */
function monthlyRate(entry: PlanCatalogEntry, period: BillingPeriod): number {
  return entry.pricing[period].amountUnits / CYCLES[period]
}

/** Same rate, GST included — what the card is actually charged per month-equivalent. */
function monthlyGrossRate(entry: PlanCatalogEntry, period: BillingPeriod): number {
  return entry.pricing[period].grossUnits / CYCLES[period]
}

/** Pro's extra-number add-on, per-month-equivalent rate — `null` on tiers without one. */
function monthlyExtraNumberRate(entry: PlanCatalogEntry, period: BillingPeriod): number | null {
  if (!entry.extraNumberPricing) return null
  return entry.extraNumberPricing[period].amountUnits / CYCLES[period]
}

/** Whole days left on a live trial, floored — `null` once it's past or unset, so the banner just doesn't render. */
function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  if (ms <= 0) return null
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

interface FeatureLine {
  text: string
  included: boolean
}

function featureLines(entry: PlanCatalogEntry): FeatureLine[] {
  const l = entry.limits
  return [
    ...UNIVERSAL_BENEFITS.map((text) => ({ text, included: true })),
    { text: `${l.numbers ?? "Unlimited"} WhatsApp ${l.numbers === 1 ? "number" : "numbers"}`, included: true },
    { text: `${l.broadcastsPerMonth ?? "Unlimited"} broadcasts / month`, included: true },
    { text: `${l.activeDrips ?? "Unlimited"} active drip sequences`, included: true },
    { text: `${l.chatbotJourneys ?? "Unlimited"} chatbot journeys`, included: true },
    { text: `${l.publishedFlows ?? "Unlimited"} published Flows`, included: true },
    { text: `${l.aiDraftsPerMonth ?? "Unlimited"} AI template drafts / month`, included: true },
    { text: l.api ? "API & webhooks" : "No API access", included: l.api },
    { text: l.aiCalling ? "WhatsApp Calling" : "No calling", included: l.aiCalling },
    { text: SUPPORT_LABEL[l.support] ?? l.support, included: true },
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
  const { data: numberAddon } = useNumberAddon(accountId)
  const { data: launchDeal } = useLaunchDealStatus()
  const trialDays = trialDaysLeft(usage?.trialEndsAt)

  const [addonQuantityInput, setAddonQuantityInput] = useState<number | null>(null)
  const [addonPhase, setAddonPhase] = useState<Phase>("idle")
  const [addonError, setAddonError] = useState<string | null>(null)
  const addonQuantity = addonQuantityInput ?? numberAddon?.quantity ?? 0

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

  const refreshAddon = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.numberAddon(accountId ?? "") })

  /** Buys the add-on (first time) or resizes it (a quantity change on an existing one). */
  const updateNumberAddon = async (quantity: number) => {
    if (!accountId || addonPhase !== "idle") return
    setAddonError(null)
    setAddonPhase("starting")

    try {
      const res = await purchaseNumberAddon(accountId, quantity)
      if (!res.checkoutRequired) {
        refreshAddon()
        setAddonPhase("idle")
        setAddonQuantityInput(null)
        return
      }

      if (!res.keyId || !res.subscriptionId) {
        throw new Error("Payment gateway did not return a checkout session")
      }
      const Razorpay = await loadRazorpayCheckout()
      const user = getCurrentUser()
      const checkout = new Razorpay({
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: "Converszio extra WhatsApp numbers",
        description: `${quantity} extra number${quantity === 1 ? "" : "s"}`,
        prefill: { name: user?.name ?? undefined, email: user?.email ?? undefined },
        handler: () => {
          setAddonPhase("confirming")
          startSubscriptionActivationWatch(`${accountId}:number-addon`, {
            fetchSubscription: () => getNumberAddon(accountId),
            onActivated: () => {
              refreshAddon()
              setAddonPhase("idle")
              setAddonQuantityInput(null)
            },
            onSlow: refreshAddon,
            onGiveUp: refreshAddon,
          })
        },
        modal: {
          ondismiss: () => {
            setAddonPhase("idle")
            setAddonError(
              "Checkout closed. If you completed the payment, it activates shortly."
            )
            refreshAddon()
          },
        },
      })
      setAddonPhase("checkout")
      checkout.open()
    } catch (err) {
      setAddonPhase("idle")
      setAddonError(getErrorMessage(err, "Couldn't update extra numbers"))
    }
  }

  const cancelNumberAddonNow = async () => {
    if (!accountId) return
    setAddonError(null)
    try {
      await cancelNumberAddon(accountId)
      refreshAddon()
      setAddonQuantityInput(null)
    } catch (err) {
      setAddonError(getErrorMessage(err, "Couldn't cancel the extra-number add-on"))
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
          {trialDays !== null && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>
                Free trial — Growth features unlocked ({trialDays} day{trialDays === 1 ? "" : "s"} left)
              </AlertTitle>
              <AlertDescription>
                No card on file. Numbers, broadcasts, drips, chatbot journeys, Flows, API access and
                calling all run at Growth's limits until the trial ends, then drop to Starter unless you
                subscribe.
              </AlertDescription>
            </Alert>
          )}

          {usage && subscription !== undefined && (
            <Alert>
              <AlertTitle className="flex items-center gap-2">
                Current plan: {TIER_LABEL[usage.plan]}
                {subscription?.cancelAtCycleEnd && " — cancelling"}
                {subscription?.foundingMember && <Badge variant="outline">Founding member</Badge>}
              </AlertTitle>
              <AlertDescription>
                {subscription?.bonusAccessUntil
                  ? `Launch deal: Growth access runs through ${new Date(subscription.bonusAccessUntil).toLocaleDateString()} (15 months for the price of 12), then drops to Starter unless you subscribe again.`
                  : subscription?.cancelAtCycleEnd && subscription.currentEnd
                    ? `Access continues until ${new Date(subscription.currentEnd).toLocaleDateString()}, then drops to Starter.`
                    : subscription?.status === "active"
                      ? `Billed ${formatMoney(subscription.total, subscription.currency)} ${subscription.billingPeriod}${subscription.taxPercent > 0 ? " (incl. GST)" : ""}. ${subscription.currentEnd ? `Next charge around ${new Date(subscription.currentEnd).toLocaleDateString()}.` : ""}`
                      : subscription?.status === "halted"
                        ? "Last payment failed and Razorpay is retrying — update your payment method to avoid losing access."
                        : "Free default — no subscription running."}
                {subscription?.foundingMemberPriceLockUntil && (
                  <>
                    {" "}
                    Renewal price locked until{" "}
                    {new Date(subscription.foundingMemberPriceLockUntil).toLocaleDateString()} — talk to
                    support to use it. Founding members also get a direct line to the product team.
                  </>
                )}
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

          {period === "yearly" && launchDeal?.open && (
            <Alert>
              <Gift className="h-4 w-4" />
              <AlertTitle>Launch deal — pay for 12 months, get 15</AlertTitle>
              <AlertDescription>
                Subscribe yearly before{" "}
                {new Date(launchDeal.cutoffDate).toLocaleDateString()} and get 3 months free.
                {launchDeal.spotsRemaining != null &&
                  ` ${launchDeal.spotsRemaining} of 250 founding-member spots left.`}
              </AlertDescription>
            </Alert>
          )}

          {catalogLoading || !catalog ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-6">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
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
                  <Card
                    key={entry.tier}
                    className={`flex h-full flex-col ${current ? "border-primary" : entry.tier === "growth" ? "border-primary/40" : ""}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{TIER_LABEL[entry.tier]}</CardTitle>
                        <div className="flex gap-1.5">
                          {entry.tier === "growth" && <Badge variant="secondary">Most Popular</Badge>}
                          {current && <Badge>Current plan</Badge>}
                        </div>
                      </div>
                      <CardDescription>{TIER_BLURB[entry.tier]}</CardDescription>
                      <div className="pt-2">
                        <span className="text-3xl font-bold">
                          {formatMoney(monthlyRate(entry, period), "INR")}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo, ex-GST</span>
                        {entry.pricing[period].taxPercent > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{entry.pricing[period].taxPercent}% GST ={" "}
                            {formatMoney(monthlyGrossRate(entry, period), "INR")}/mo charged
                          </p>
                        )}
                        {period !== "monthly" && (
                          <p className="text-xs text-muted-foreground">
                            billed {formatMoney(entry.pricing[period].grossUnits, "INR")} {period}
                            {entry.pricing[period].taxPercent > 0 && " incl. GST"}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-1.5 text-sm">
                        {featureLines(entry).map((line) => (
                          <li
                            key={line.text}
                            className={`flex items-start gap-2 ${line.included ? "" : "text-muted-foreground"}`}
                          >
                            {line.included ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                            )}
                            <span>{line.text}</span>
                          </li>
                        ))}
                      </ul>
                      {monthlyExtraNumberRate(entry, period) !== null && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          +{formatMoney(monthlyExtraNumberRate(entry, period)!, "INR")}/mo per extra
                          WhatsApp number beyond the {entry.limits.numbers}
                        </p>
                      )}
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

          {subscriptionLive && subscription?.tier === "pro" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Extra WhatsApp numbers</CardTitle>
                <CardDescription>
                  Pro includes 5 numbers. Add more at{" "}
                  {formatMoney(numberAddon?.amountPerUnit ?? 999, numberAddon?.currency ?? "INR")}
                  /mo each, billed on the same {subscription.billingPeriod} cycle as Pro.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={addonQuantity}
                  onChange={(e) =>
                    setAddonQuantityInput(Math.max(0, Math.min(50, Number(e.target.value) || 0)))
                  }
                  className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Extra WhatsApp numbers"
                />
                <Button
                  size="sm"
                  disabled={
                    addonPhase !== "idle" ||
                    addonQuantity === (numberAddon?.quantity ?? 0) ||
                    (addonQuantity === 0 && !numberAddon)
                  }
                  onClick={() =>
                    addonQuantity === 0 ? cancelNumberAddonNow() : updateNumberAddon(addonQuantity)
                  }
                >
                  {addonPhase !== "idle" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {numberAddon ? "Update" : "Add"}
                </Button>
                {numberAddon &&
                  !numberAddon.cancelAtCycleEnd &&
                  ["created", "authenticated", "active", "halted"].includes(numberAddon.status) && (
                    <Button size="sm" variant="outline" onClick={cancelNumberAddonNow}>
                      Cancel add-on
                    </Button>
                  )}
              </CardContent>
              {numberAddon?.cancelAtCycleEnd && numberAddon.currentEnd && (
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Extra numbers stay active until{" "}
                  {new Date(numberAddon.currentEnd).toLocaleDateString()}, then drop off.
                </CardContent>
              )}
              {addonError && (
                <CardContent className="pt-0">
                  <Alert variant="destructive">
                    <AlertDescription>{addonError}</AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>
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

          <SubscriptionInvoicesTable accountId={accountId} />
        </>
      )}
    </div>
  )
}
