"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileText, Loader2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Explain } from "@/components/explain"
import { PageHeader } from "@/components/page-header"
import { useAccountId } from "@/hooks/use-account-id"
import { getErrorMessage } from "@/lib/errors"
import { getWhatsappBusinessAccount, type WhatsappBusinessAccountItem } from "@/services/api"

/**
 * Templates, findable.
 *
 * A campaign cannot exist without an approved template, and yet the only way
 * to reach one was `/dashboard/whatsapp/<accountId>/templates?wabaId=<wabaId>`
 * — a URL nobody types, under "WhatsApp setup", absent from the nav. The one
 * mandatory artifact in the product was the hardest thing in it to find.
 *
 * This is the front door. It resolves the ids that URL needs and forwards, so
 * the real screen stays where it is rather than being duplicated:
 *
 * - one WhatsApp Business Account (the normal case) — straight through
 * - several — pick which
 * - none — say so, and point at setup rather than 404ing
 *
 * Note the route segment is named `[wabaId]` but is read as the *account* id,
 * with the actual WABA id in the query string. Both are passed here explicitly
 * so the mismatch stays in one place.
 */
export default function TemplatesEntryPage() {
  const router = useRouter()
  const { accountId, resolved: accountResolved, error: accountError } = useAccountId()

  const [wabas, setWabas] = useState<WhatsappBusinessAccountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const templatesHref = useCallback(
    (wabaId: string) =>
      `/dashboard/whatsapp/${encodeURIComponent(accountId ?? "")}/templates?wabaId=${encodeURIComponent(wabaId)}`,
    [accountId],
  )

  useEffect(() => {
    if (!accountId) {
      // Stop showing a spinner once we know there is no account to ask about.
      if (accountResolved) setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getWhatsappBusinessAccount(accountId)
      .then((res) => {
        if (cancelled) return
        const list = res?.data ?? []
        setWabas(list)
        setLoadError(null)
        // Sole account: this page has nothing to ask, so don't make them click.
        // `replace`, not `push` — Back should leave, not bounce back here.
        if (list.length === 1) router.replace(templatesHref(list[0].id))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(getErrorMessage(err) || "Couldn't load your WhatsApp Business Accounts")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, accountResolved, router, templatesHref])

  const description = (
    <>
      Message <Explain term="template">templates</Explain> Meta has approved. A campaign can only
      send one of these.
    </>
  )

  if (loading || (wabas.length === 1 && !loadError)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Templates" description={description} />
        <Card>
          <CardContent className="flex items-center gap-3 py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Opening your templates…</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Templates" description={description} />

      {loadError ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              plain
              icon={TriangleAlert}
              title="Couldn't load your WhatsApp Business Accounts"
              description={`${loadError}. Your templates are unaffected — this is a problem reading the account list.`}
              action={
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : !accountId ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              plain
              icon={FileText}
              title={
                accountError ? "Couldn't check your linked accounts" : "No connected account yet"
              }
              description={
                accountError
                  ? "Templates belong to a WhatsApp Business Account, and that lookup failed. This is a connection problem, not a missing account."
                  : "Templates live on a WhatsApp Business Account. Connect one and they show up here."
              }
              action={
                <Button asChild>
                  <Link href="/dashboard/whatsapp/new">Connect an account</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : wabas.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              plain
              icon={FileText}
              title="No WhatsApp Business Account yet"
              description="Templates are approved per WhatsApp Business Account. Finish setup and this fills in."
              action={
                <Button asChild>
                  <Link href="/dashboard/whatsapp">Go to WhatsApp setup</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Choose an account</CardTitle>
            <CardDescription>
              Templates are approved separately for each WhatsApp Business Account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {wabas.map((waba) => (
                <Link
                  key={waba.id}
                  href={templatesHref(waba.id)}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-subtle p-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {waba.name || waba.details?.verified_name || "WhatsApp Business Account"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {waba.details?.display_phone_number || waba.id}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
