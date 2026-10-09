"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/errors"
import { useAccountId } from "@/hooks/use-account-id"
import { getMarkupSettings, type MarkupSettings } from "@/services/api"

/**
 * Pricing configuration — an **ops screen**, not a customer one.
 *
 * Retired 2026-10-10 (decided 2026-09-30, see
 * docs/revenue-and-business-plan.md "No wallet, no markup"): the markup that
 * used to live here no longer applies to any charge — `recordUsage` never
 * reads it — and the backend now refuses `PATCH /billing/markup*` outright.
 * This page dropped the two write forms and shows the stored config read-only,
 * in case the %-of-revenue add-on the commercial-model doc leaves open ever
 * gets designed and this needs reviving.
 *
 * Still deliberately not linked from the navigation.
 */
export default function PricingSettingsPage() {
  const { accountId, resolved } = useAccountId()
  const [settings, setSettings] = useState<MarkupSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMarkupSettings(accountId)
      setSettings(res)
    } catch (err) {
      setLoadError(getErrorMessage(err) || "Couldn't load pricing")
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Settings
          </Link>
        </Button>
        <PageHeader
          title="Pricing"
          description="Markup is retired — this is the dormant stored config, read-only."
        />
      </div>

      <Card className="border-muted-foreground/30 bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground">
          No markup is charged on any message any more (decided 2026-09-30). Nothing below affects
          what an account pays — it&apos;s the old configuration, kept in case a future %-of-revenue
          add-on reuses it.
        </CardContent>
      </Card>

      {resolved && !accountId ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Wallet}
              title="No connected account yet"
              description="Nothing to show until an account is linked."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load the pricing settings"
              description={loadError}
              action={
                <Button variant="outline" onClick={fetchSettings}>
                  Try again
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : settings ? (
        <Card>
          <CardHeader>
            <CardTitle>Stored config (unused)</CardTitle>
            <CardDescription>
              What this account would have paid on top of Meta&apos;s cost, back when markup applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Effective markup</p>
              <p className="text-2xl font-bold">{settings.effectivePercent}%</p>
              <p className="text-xs text-muted-foreground">
                {settings.accountPercent != null ? "negotiated rate" : "following the default"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Platform default</p>
              <p className="text-2xl font-bold">{settings.globalPercent}%</p>
              <p className="text-xs text-muted-foreground">
                env floor {settings.envDefaultPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Input tax</p>
              <p className="text-2xl font-bold">{settings.inputTaxPercent}%</p>
              <p className="text-xs text-muted-foreground">
                still real — see the Meta cost view, unrelated to markup
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
