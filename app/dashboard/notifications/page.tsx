"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, CheckCircle, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react"
import { acknowledgeAlert, type QualityAlert } from "@/services/api"
import { useAccountId } from "@/hooks/use-account-id"
import { useAlerts, queryKeys } from "@/hooks/use-queries"
import { messagingTierLabel } from "@/components/quality-badge"
import { Explain } from "@/components/explain"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

// Plain-language meaning of a Meta quality rating, so a non-technical user knows
// what to actually do when their number's health changes.
function ratingMeaning(rating: string): { label: string; advice: string } {
  switch ((rating || "").toUpperCase()) {
    case "GREEN":
      return { label: "Healthy", advice: "Good to send — no action needed." }
    case "YELLOW":
      return { label: "At risk", advice: "Reduce marketing volume this week and watch replies." }
    case "RED":
      return { label: "Flagged", advice: "Pause marketing. Send only service replies until it recovers." }
    case "FLAGGED":
      return { label: "Flagged by Meta", advice: "Stop marketing sends — sending more risks a block." }
    default:
      return { label: rating || "Updated", advice: "Quality rating changed." }
  }
}

function severityOf(rating: string): "error" | "warning" | "success" | "info" {
  switch ((rating || "").toUpperCase()) {
    case "RED":
    case "FLAGGED":
      return "error"
    case "YELLOW":
      return "warning"
    case "GREEN":
      return "success"
    default:
      return "info"
  }
}

function alertIcon(rating: string) {
  switch (severityOf(rating)) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-success" />
    case "error":
      return <ShieldAlert className="h-5 w-5 text-destructive" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-warning" />
    default:
      return <Bell className="h-5 w-5 text-info" />
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationsPage() {
  // Shared, cached account lookup — see hooks/use-account-id. Resolving it here
  // by hand meant a transient failure rendered "No account connected" for an
  // account that exists.
  const { accountId, resolved, error: accountError } = useAccountId()
  // Shared cache with the sidebar badge, so marking one read decrements the
  // count in the same paint.
  const { data, isLoading: isLoadingAlerts } = useAlerts(accountId)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("all")
  const [busyId, setBusyId] = useState<string | null>(null)

  const alerts: QualityAlert[] = Array.isArray(data) ? data : []
  const isLoading = !resolved || (Boolean(accountId) && isLoadingAlerts)

  // Write the acked rows straight into the cache instead of refetching: the ack
  // response is authoritative and the list is small.
  const markRead = (ids: Set<string>) =>
    queryClient.setQueryData<QualityAlert[]>(queryKeys.alerts(accountId ?? ""), (prev) =>
      (prev ?? []).map((a) => (ids.has(a.id) ? { ...a, acknowledged: true } : a))
    )

  const ack = async (id: string) => {
    if (!accountId) return
    setBusyId(id)
    try {
      await acknowledgeAlert(id, accountId)
      markRead(new Set([id]))
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to mark as read")
    } finally {
      setBusyId(null)
    }
  }

  const ackAll = async () => {
    if (!accountId) return
    const unread = alerts.filter((a) => !a.acknowledged)
    try {
      await Promise.all(unread.map((a) => acknowledgeAlert(a.id, accountId)))
      markRead(new Set(unread.map((a) => a.id)))
      toast.success("All marked as read")
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to mark all as read")
    }
  }

  const unreadCount = alerts.filter((a) => !a.acknowledged).length
  const filtered = alerts.filter((a) => {
    if (activeTab === "unread") return !a.acknowledged
    if (activeTab === "critical") return severityOf(a.newRating) === "error"
    return true
  })

  const criticalCount = alerts.filter((a) => severityOf(a.newRating) === "error").length

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <PageHeader
          title="Notifications"
          description={
            unreadCount > 0
              ? `${unreadCount} unread — Meta tells us when a number's health changes, and this is where it lands.`
              : "Meta tells us when a number's health changes, and this is where it lands."
          }
          actions={
            <Button variant="outline" onClick={ackAll} disabled={unreadCount === 0}>
              Mark all as read
            </Button>
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Counts on the tabs: without them "Critical" is a tab you have to open
            to find out whether it was worth opening. */}
        <TabsList className="grid w-full grid-cols-3 mb-6 max-w-md">
          <TabsTrigger value="all">All{alerts.length > 0 ? ` (${alerts.length})` : ""}</TabsTrigger>
          <TabsTrigger value="unread">
            Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="critical">
            Critical{criticalCount > 0 ? ` (${criticalCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Number health alerts</CardTitle>
              <CardDescription>
                Automatic alerts when a WhatsApp number&apos;s quality rating changes. Acting on
                these early keeps your number from being restricted by Meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                // Skeletons shaped like the rows they replace, so the card
                // doesn't resize when the alerts land.
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
                      <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-56" />
                        <Skeleton className="h-3 w-full max-w-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : accountError ? (
                <EmptyState
                  plain
                  icon={AlertTriangle}
                  title="Couldn't check your account"
                  description="We couldn't reach the server. Your alerts are safe — this is a connection problem, not a missing account."
                  action={
                    <Button variant="outline" onClick={() => window.location.reload()}>
                      Try again
                    </Button>
                  }
                />
              ) : !accountId ? (
                <EmptyState
                  plain
                  icon={Bell}
                  title="No account connected"
                  description="Health alerts come from Meta about a specific number, so there's nothing to report until a WhatsApp account is linked."
                  action={
                    <Button asChild>
                      <Link href="/dashboard/whatsapp">Connect WhatsApp</Link>
                    </Button>
                  }
                />
              ) : filtered.length > 0 ? (
                <div className="space-y-3">
                  {filtered.map((a) => {
                    const meaning = ratingMeaning(a.newRating)
                    return (
                      <div
                        key={a.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border ${
                          a.acknowledged ? "bg-card" : "bg-accent/40 border-primary/20"
                        }`}
                      >
                        <div className="mt-0.5">{alertIcon(a.newRating)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            {/*
                              The Explain trigger sits outside the truncating h3
                              (shrink-0 on the wrapper), or a long display number
                              would clip the `?` away exactly when it's needed.
                            */}
                            <div className="flex min-w-0 items-center">
                              <h3 className="font-medium truncate">
                                Number quality: {meaning.label}
                                {a.displayPhoneNumber ? ` · ${a.displayPhoneNumber}` : ""}
                              </h3>
                              <span className="shrink-0">
                                <Explain term="quality-rating" />
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {relativeTime(a.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {a.oldRating ? `Changed from ${a.oldRating} to ${a.newRating}. ` : `Now ${a.newRating}. `}
                            {meaning.advice}
                          </p>
                          {/*
                            Was ` (Messaging tier: TIER_1K.)` — Meta's raw enum,
                            meaningless to a shop owner. messagingTierLabel turns
                            it into the number that actually matters, and returns
                            null for tiers it doesn't know rather than leaking
                            the enum through.
                          */}
                          {messagingTierLabel(a.tier) && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Daily limit: {messagingTierLabel(a.tier)}
                              <Explain term="messaging-tier" />
                            </p>
                          )}
                          {a.reason && (
                            <p className="text-xs text-muted-foreground mt-1">Reason: {a.reason}</p>
                          )}
                          {!a.acknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-8 px-2 text-xs"
                              disabled={busyId === a.id}
                              onClick={() => ack(a.id)}
                            >
                              {busyId === a.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : null}
                              Mark as read
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  plain
                  icon={CheckCircle}
                  title="All clear"
                  description={
                    activeTab === "unread"
                      ? "You've read every alert."
                      : activeTab === "critical"
                        ? "Nothing critical. A critical alert means Meta has flagged a number, and there is none."
                        : "No health alerts yet. Nothing here is good news — an empty list means Meta hasn't complained about any of your numbers."
                  }
                />
              )}
            </CardContent>
          </Card>

          {/*
            Was a "Notification Settings" card whose button promised to "Manage
            Notification Preferences". There are none to manage — settings says
            so itself — so the button led to a page explaining the thing it had
            just offered didn't exist. A sentence that tells the truth is
            smaller and more useful than a card that doesn't.
          */}
          <p className="text-sm text-muted-foreground">
            These alerts are always on and can&apos;t be turned off — a number being restricted is
            not something to opt out of hearing about. Receiving them by email or push is still
            being built.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
