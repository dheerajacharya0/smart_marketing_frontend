"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { History, Loader2, Mails, Megaphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { getErrorMessage } from "@/lib/errors"
import { getContactActivity, type ContactActivityItem } from "@/services/api"

const PAGE_SIZE = 20

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Neutral for in-progress states, red only for an actual failure. */
function StatusBadge({ status }: { status: string }) {
  const failed = status === "failed"
  const done = status === "read" || status === "delivered" || status === "completed"
  if (failed) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
        {status}
      </Badge>
    )
  }
  if (done) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
        {status}
      </Badge>
    )
  }
  return <Badge variant="outline">{status}</Badge>
}

/**
 * Which campaigns and drips this contact has been in.
 *
 * Reads the reverse index the backend added for exactly this: sends are
 * otherwise queryable only per-campaign and per-drip, so building it here would
 * mean fanning out across every campaign and drip on the account. That's why
 * this section didn't exist before rather than being approximated.
 */
export function ContactActivity({
  contactId,
  accountId,
}: {
  contactId: string
  accountId: string | null | undefined
}) {
  const [items, setItems] = useState<ContactActivityItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getContactActivity(contactId, accountId, shown, 0)
      setItems(Array.isArray(res.items) ? res.items : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      setError(getErrorMessage(err) || "Couldn't load this contact's history")
    } finally {
      setLoading(false)
    }
  }, [contactId, accountId, shown])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Campaigns &amp; drips
        </CardTitle>
        <CardDescription>
          Everything this contact has been sent, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Not in any campaign or drip yet"
            description="Broadcasts and sequences this contact receives will be listed here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={`${item.kind}-${i}`}
                className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.kind === "campaign" ? (
                      <Megaphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Mails className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <Link
                      href={
                        item.kind === "campaign"
                          ? `/dashboard/campaigns/${item.campaignId}`
                          : `/dashboard/drips/${item.dripId}`
                      }
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {item.kind === "campaign" ? item.campaignName : item.dripName}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatWhen(item.at)}
                    {item.kind === "drip" ? ` · step ${item.stepIndex + 1}` : ""}
                  </p>
                  {/* One free-text field, not a Meta code/title pair — shown as
                      it is rather than parsed into fields it can't fill. */}
                  {item.error && (
                    <p className="mt-0.5 text-xs text-destructive">{item.error}</p>
                  )}
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}

            {total > items.length && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setShown((n) => n + PAGE_SIZE)}
              >
                {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Show more ({total - items.length} older)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
