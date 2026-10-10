"use client"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, Check, Loader2, Rocket } from "lucide-react"
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
import { queryKeys, useGuidedLaunch } from "@/hooks/use-queries"
import { formatMoney } from "@/lib/money"
import { getErrorMessage } from "@/lib/errors"
import { loadRazorpayCheckout } from "@/lib/razorpay"
import { startGuidedLaunchSettlementWatch } from "@/lib/guided-launch-settlement-watch"
import {
  cancelGuidedLaunch,
  getCurrentUser,
  getGuidedLaunch,
  isServiceUnavailable,
  purchaseGuidedLaunch,
} from "@/services/api"

type Phase = "idle" | "starting" | "checkout" | "confirming" | "unavailable"

const MILESTONES = [
  { key: "numberConnectedAt" as const, label: "WhatsApp number connected" },
  { key: "templateApprovedAt" as const, label: "First template approved" },
  { key: "firstCampaignReadyAt" as const, label: "First campaign ready to send" },
]

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function GuidedLaunchPage() {
  const { accountId, resolved } = useAccountId()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>("idle")
  const [inlineError, setInlineError] = useState<string | null>(null)

  const { data: launch, isLoading } = useGuidedLaunch(accountId)
  const busy = phase === "starting" || phase === "checkout" || phase === "confirming"

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.guidedLaunch(accountId ?? "") })
  }

  const purchase = async () => {
    if (!accountId || busy) return
    setInlineError(null)
    setPhase("starting")
    try {
      const order = await purchaseGuidedLaunch(accountId)
      const Razorpay = await loadRazorpayCheckout()
      const user = getCurrentUser()
      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amountMinorUnits,
        currency: order.currency,
        order_id: order.orderId,
        name: "Converszio Guided Launch",
        description: "15-Day Guided Launch (one-time)",
        prefill: { name: user?.name ?? undefined, email: user?.email ?? undefined },
        handler: () => {
          // Gateway accepted the payment. Settlement — and so the milestone
          // clock becoming possible — only happens once the webhook lands.
          setPhase("confirming")
          startGuidedLaunchSettlementWatch(accountId, {
            fetchGuidedLaunch: async () => {
              const result = await getGuidedLaunch(accountId)
              // Purchase just started Checkout, so the row exists by now —
              // this narrows the pre-purchase variant (no `status`) away for
              // the watcher's generic constraint, not a real runtime case.
              return result.purchased ? result : null
            },
            onSettled: () => {
              refresh()
              setPhase("idle")
            },
            onSlow: refresh,
            onGiveUp: refresh,
          })
        },
        modal: {
          ondismiss: () => {
            setPhase("idle")
            setInlineError(
              "Checkout closed. If you completed the payment, this updates shortly."
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
      setInlineError(getErrorMessage(err, "Couldn't start the purchase"))
    }
  }

  const cancel = async () => {
    if (!accountId) return
    setInlineError(null)
    try {
      await cancelGuidedLaunch(accountId)
      refresh()
    } catch (err) {
      setInlineError(getErrorMessage(err, "Couldn't cancel Guided Launch"))
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
          title="Guided Launch"
          description="₹999 one-time, 15 days, no performance fee — guided onboarding to your first real campaign. One per business."
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
                The payment gateway isn&apos;t set up on this server yet — contact support.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-3 rounded-lg border p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : launch && !launch.purchased ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  15-Day Guided Launch
                </CardTitle>
                <CardDescription>
                  One WhatsApp number, guided setup of your first campaign and template, one
                  follow-up journey, one performance review. 15,000 contacts/month audience cap
                  included. The clock starts once your number is connected, a template is
                  approved, and your first campaign is ready — not at payment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatMoney(launch.pricing.amountUnits, "INR")}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {launch.pricing.taxPercent > 0
                      ? `+ ${launch.pricing.taxPercent}% GST = ${formatMoney(launch.pricing.grossUnits, "INR")}, one-time`
                      : "one-time"}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={purchase} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buy Guided Launch
                </Button>
              </CardFooter>
            </Card>
          ) : launch && launch.purchased ? (
            <>
              <Alert>
                <AlertTitle className="flex items-center gap-2">
                  Status: {launch.status[0].toUpperCase() + launch.status.slice(1)}
                  {launch.status === "active" && <Badge>Clock running</Badge>}
                </AlertTitle>
                <AlertDescription>
                  {launch.status === "created" &&
                    "Waiting for payment confirmation — this updates on its own shortly."}
                  {launch.status === "paid" &&
                    "Paid. The 15-day clock starts once all three milestones below are done."}
                  {launch.status === "active" && launch.expiresAt &&
                    `Running until ${formatDate(launch.expiresAt)}.`}
                  {launch.status === "completed" &&
                    "The 15-day window ended. Your account is on its normal plan now."}
                  {launch.status === "converted" &&
                    "Converted to a paid plan — the ₹999 was refunded as your upgrade credit."}
                  {launch.status === "cancelled" &&
                    `Cancelled${launch.refundMicros ? ", refund issued" : ""}.`}
                </AlertDescription>
              </Alert>

              {(launch.status === "paid" || launch.status === "active") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Activation</CardTitle>
                    <CardDescription>All three start the 15-day clock.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {MILESTONES.map((m) => {
                        const done = Boolean(launch[m.key])
                        return (
                          <li key={m.key} className="flex items-center gap-2">
                            <Check
                              className={`h-4 w-4 shrink-0 ${done ? "text-primary" : "text-muted-foreground/30"}`}
                            />
                            <span className={done ? "" : "text-muted-foreground"}>{m.label}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {launch.status === "active" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cancel Guided Launch</CardTitle>
                    <CardDescription>
                      Refunded pro-rated by days used out of 15, to the original card.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline">Cancel</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Guided Launch?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You&apos;ll be refunded for the unused days, and the audience-cap
                            override ends immediately. This can&apos;t be undone — Guided Launch
                            is one per business.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={cancel}>Cancel Guided Launch</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
