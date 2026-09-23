"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Activity, ArrowLeft, BarChart3, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { Explain } from "@/components/explain"
import { describeApiHealth } from "@/lib/metric-reads"
import { EmptyState } from "@/components/empty-state"
import { StatStrip, type Stat } from "@/components/stat-strip"
import { useAccountId } from "@/hooks/use-account-id"
import { getErrorMessage } from "@/lib/errors"
import { DataTable, type Column } from "@/components/data-table"
import { ApiKeysCard } from "@/components/api-keys-card"
import { ApiQuickstartCard } from "@/components/api-quickstart-card"
import { WebhookEndpointsCard } from "@/components/webhook-endpoints-card"
import {
  getAnalyticsOverview,
  getApiUsage,
  getMessagingAnalytics,
  type AnalyticsOverview,
  type ApiUsageEndpoint,
  type ApiUsageSummary,
  type MessagingAnalytics,
} from "@/services/api"
import { DateRangePicker, DEFAULT_RANGE, type AnalyticsRange } from "../date-range-picker"
import { MessagingVolumeChart } from "../messaging-volume-chart"
import { intervalForRange } from "../analytics-utils"

/**
 * Message usage. Previously this page rendered entirely fabricated numbers —
 * invented account names, per-endpoint call counts, latency percentiles and
 * error rates, none of which the backend tracks. It read as live telemetry and
 * was not, which is worse than showing nothing.
 *
 * The invented numbers were replaced by message volume alone, with per-endpoint
 * metrics left as an honest "not tracked yet". The backend now records a usage
 * row per API-key request, so those metrics are real here — but only for calls
 * made with a key. Dashboard traffic is deliberately not counted, and the card
 * says so rather than letting a quiet table read as "nothing is working".
 */
export default function ApiUsagePage() {
  const { accountId, resolved } = useAccountId()
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE)

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [messaging, setMessaging] = useState<MessagingAnalytics | null>(null)
  const [apiUsage, setApiUsage] = useState<ApiUsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fromIso = range.from.toISOString()
  const toIso = range.to.toISOString()

  const fetchUsage = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    try {
      const [overviewRes, messagingRes, apiUsageRes] = await Promise.all([
        getAnalyticsOverview(accountId, fromIso, toIso),
        getMessagingAnalytics(
          accountId,
          fromIso,
          toIso,
          intervalForRange(range.from, range.to)
        ),
        // Secondary to message volume: an account with no API keys has nothing
        // here, and that shouldn't take the whole page down.
        getApiUsage(accountId, fromIso, toIso).catch(() => null),
      ])
      setOverview(overviewRes)
      setMessaging(messagingRes)
      setApiUsage(apiUsageRes)
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to load usage")
    } finally {
      setLoading(false)
    }
  }, [accountId, fromIso, toIso, range.from, range.to])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  if (resolved && !accountId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Message usage" description="How many messages you've sent and received." />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BarChart3}
              title="No connected account yet"
              description="Link a WhatsApp account to see your message usage."
              action={
                <Button asChild>
                  <Link href="/dashboard/whatsapp">Connect WhatsApp</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Endpoint rows arrive complete (no paging), so sorting them client-side
  // is honest — "which endpoint errors most" is one header click.
  const endpointColumns: Column<ApiUsageEndpoint>[] = [
    {
      key: "endpoint",
      header: "Endpoint",
      card: "title",
      sortValue: (row) => `${row.path} ${row.method}`,
      cell: (row) => (
        <span className="font-mono text-xs">
          <span className="text-muted-foreground">{row.method}</span> {row.path}
        </span>
      ),
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      cardLabel: "Requests",
      sortValue: (row) => row.requests,
      cell: (row) => <span className="tabular-nums">{row.requests.toLocaleString()}</span>,
    },
    {
      key: "errors",
      header: "Errors",
      align: "right",
      cardLabel: "Errors",
      sortValue: (row) => row.errors,
      cell: (row) => (
        <span className={`tabular-nums ${row.errors > 0 ? "text-destructive" : ""}`}>
          {row.errors.toLocaleString()}
        </span>
      ),
    },
    {
      key: "throttled",
      header: "Throttled",
      align: "right",
      cardLabel: "Throttled",
      sortValue: (row) => row.rateLimited,
      // Throttling is the one number a customer can act on directly — it
      // means raise the tier or slow down.
      cell: (row) => (
        <span className={`tabular-nums ${row.rateLimited > 0 ? "text-warning" : ""}`}>
          {row.rateLimited.toLocaleString()}
        </span>
      ),
    },
    {
      key: "avg",
      header: "Avg time",
      align: "right",
      cardLabel: "Avg time",
      sortValue: (row) => row.avgDurationMs,
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">{row.avgDurationMs}ms</span>
      ),
    },
  ]

  // Summed from the endpoint rows: the summary carries a request total but not
  // an error or throttle total, and the rows arrive complete, so this is the
  // same population rather than a sample of it.
  const apiHealthRead = apiUsage
    ? describeApiHealth({
        totalRequests: apiUsage.totalRequests,
        errors: apiUsage.endpoints.reduce((sum, row) => sum + row.errors, 0),
        rateLimited: apiUsage.endpoints.reduce((sum, row) => sum + row.rateLimited, 0),
      })
    : null

  const m = overview?.messaging
  const stats: Stat[] = m
    ? [
        {
          label: "Messages sent",
          value: m.outbound.toLocaleString(),
          hint: "Campaigns and inbox replies",
        },
        {
          label: "Messages received",
          value: m.inbound.toLocaleString(),
          hint: "Inbound from your contacts",
        },
        {
          label: "Total messages",
          value: (m.inbound + m.outbound).toLocaleString(),
          hint: range.label.toLowerCase(),
        },
      ]
    : []

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
          title="Message usage"
          description="How many messages you've sent and received."
          actions={<DateRangePicker range={range} onChange={setRange} />}
        />
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
            <p className="mb-3 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchUsage}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading || !m ? (
        <div className="hud-strip">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="hud-stat space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <StatStrip stats={stats} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Volume over time</CardTitle>
          <CardDescription>Inbound vs outbound messages</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? null : loading || !messaging ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <MessagingVolumeChart data={messaging} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-endpoint API metrics</CardTitle>
          <CardDescription>
            Requests made with your <Explain term="api-key">API keys</Explain> — calls you make from
            the dashboard aren&apos;t counted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Silent while the integration is healthy: a permanent green line is
              one more thing to stop reading. */}
          {apiHealthRead && <p className="text-sm text-muted-foreground">{apiHealthRead}</p>}

          <DataTable
            columns={endpointColumns}
            rows={apiUsage?.endpoints ?? []}
            getRowKey={(row) => `${row.method} ${row.path}`}
            isLoading={loading}
            skeletonRows={4}
            defaultSortKey="requests"
            defaultSortDirection="desc"
            empty={
              <EmptyState
                icon={Activity}
                title="No API calls yet"
                description="Once something calls the API with one of your keys, its requests, errors and response times show up here."
              />
            }
          />
        </CardContent>
      </Card>

      <ApiKeysCard accountId={accountId} onKeysChanged={fetchUsage} />

      {/* Below the keys card on purpose: the key is minted first, and this is
          what was missing afterwards — a base URL, the header, and a request
          that runs. */}
      <ApiQuickstartCard accountId={accountId} />

      {/* Events flowing the other way: we call the customer, they don't call us. */}
      <WebhookEndpointsCard accountId={accountId} />
    </div>
  )
}
