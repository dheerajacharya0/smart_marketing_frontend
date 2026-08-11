"use client"

import { useState, useEffect, useCallback } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, CheckCircle, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react"
import {
  listAlerts,
  acknowledgeAlert,
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFacebookAccounts,
  type QualityAlert,
} from "@/services/api"

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
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case "error":
      return <ShieldAlert className="h-5 w-5 text-red-500" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />
    default:
      return <Bell className="h-5 w-5 text-blue-500" />
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
  const [accountId, setAccountId] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<QualityAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [busyId, setBusyId] = useState<string | null>(null)

  // Resolve the current account (active WhatsApp context, else first linked FB account).
  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext(user.id)
        if (ctx) {
          setAccountId(ctx.accountId)
          return
        }
        const accountsRes: any = await getFacebookAccounts(user.id)
        const accounts = Array.isArray(accountsRes) ? accountsRes : accountsRes?.data
        const fbAccount = (accounts || []).find((a: any) => a.type === "facebook")
        if (fbAccount) setAccountId(fbAccount.id)
        else setIsLoading(false)
      } catch (err) {
        console.error("Failed to resolve account:", err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const loadAlerts = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    try {
      const res = await listAlerts(accountId)
      setAlerts(Array.isArray(res) ? res : [])
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load notifications")
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    if (accountId) loadAlerts()
  }, [accountId, loadAlerts])

  const ack = async (id: string) => {
    if (!accountId) return
    setBusyId(id)
    try {
      await acknowledgeAlert(id, accountId)
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)))
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
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })))
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

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <div className="ml-2 bg-primary text-primary-foreground rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center text-xs font-mono">
              {unreadCount}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={ackAll} disabled={unreadCount === 0}>
          Mark All as Read
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 max-w-md">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="critical">Critical</TabsTrigger>
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
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading notifications…
                </div>
              ) : !accountId ? (
                <div className="text-center py-10">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-lg">No account connected</h3>
                  <p className="text-muted-foreground">
                    Connect a WhatsApp Business account to receive health alerts.
                  </p>
                </div>
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
                            <h3 className="font-medium truncate">
                              Number quality: {meaning.label}
                              {a.displayPhoneNumber ? ` · ${a.displayPhoneNumber}` : ""}
                            </h3>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {relativeTime(a.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {a.oldRating ? `Changed from ${a.oldRating} to ${a.newRating}. ` : `Now ${a.newRating}. `}
                            {meaning.advice}
                            {a.tier ? ` (Messaging tier: ${a.tier}.)` : ""}
                          </p>
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
                <div className="text-center py-10">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="font-medium text-lg">All clear</h3>
                  <p className="text-muted-foreground">
                    {activeTab === "unread"
                      ? "You've read all your notifications."
                      : activeTab === "critical"
                        ? "No critical alerts — your numbers are healthy."
                        : "No health alerts yet. We'll notify you if a number's quality drops."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/dashboard/settings">
                  <Bell className="h-4 w-4 mr-2" />
                  Manage Notification Preferences
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
