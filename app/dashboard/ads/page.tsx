"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bot, ExternalLink, MessageSquare, Target, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatStrip } from "@/components/stat-strip"
import { useAccountId } from "@/hooks/use-account-id"
import { useAdClicks, useAds } from "@/hooks/use-queries"
import { adLabel } from "@/lib/ads"
import { getErrorMessage } from "@/lib/errors"
import { formatDate, formatDateTime } from "@/lib/format-date"
import { adStarterId } from "@/lib/segment-starters"
import type { AdClick, AdSummary } from "@/services/api"

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
] as const

/**
 * Click-to-WhatsApp ads: which ads start chats, and who they brought in.
 *
 * Nothing here needs the Facebook ads account. Meta stamps the ad onto the
 * first message of a chat it started (`referral`), and the backend records it,
 * so this works for every ad the business runs, from Ads Manager or a boosted
 * post, with no extra permission.
 */
export default function AdsPage() {
  const { accountId, resolved, error: accountError } = useAccountId()
  const [days, setDays] = useState(30)
  const [openAd, setOpenAd] = useState<AdSummary | null>(null)

  const { data: ads, isLoading, error } = useAds(accountId, days)

  const totals = useMemo(() => {
    const rows = ads ?? []
    return {
      ads: rows.length,
      chats: rows.reduce((sum, ad) => sum + ad.clicks, 0),
      // Summed per ad, so one person who came from two ads counts twice. Said
      // so on the tile rather than presented as a unique count.
      people: rows.reduce((sum, ad) => sum + ad.contacts, 0),
    }
  }, [ads])

  const columns: Column<AdSummary>[] = [
    {
      key: "ad",
      header: "Ad",
      card: "title",
      sortValue: (ad) => adLabel(ad).toLowerCase(),
      cell: (ad) => (
        <div className="flex min-w-0 items-center gap-3">
          <AdThumb url={ad.thumbnailUrl} />
          <div className="min-w-0">
            <p className="truncate font-medium">{adLabel(ad)}</p>
            <p className="text-xs text-muted-foreground">
              {ad.sourceType === "post" ? "Boosted post" : "Ad"}
              {ad.mediaType ? ` · ${ad.mediaType}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "clicks",
      header: "Chats",
      align: "right",
      card: "meta",
      cardLabel: "Chats",
      sortValue: (ad) => ad.clicks,
      cell: (ad) => <span className="tabular-nums">{ad.clicks}</span>,
    },
    {
      key: "contacts",
      header: "People",
      align: "right",
      card: "meta",
      cardLabel: "People",
      sortValue: (ad) => ad.contacts,
      cell: (ad) => <span className="tabular-nums">{ad.contacts}</span>,
    },
    {
      key: "last",
      header: "Last chat",
      card: "meta",
      cardLabel: "Last chat",
      sortValue: (ad) => ad.lastClickAt,
      cell: (ad) => formatDate(ad.lastClickAt),
    },
  ]

  if (resolved && !accountId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ads" />
        <p className="text-sm text-destructive">
          {accountError ? getErrorMessage(accountError, "Couldn't load your account.") : "No account found."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ads"
        description="Chats started from your Click-to-WhatsApp ads and boosted posts, and who they brought in."
        icon={<Target className="h-5 w-5" />}
        actions={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-9 w-40" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {!error && (ads?.length ?? 0) > 0 && (
        <StatStrip
          stats={[
            { label: "Ads with chats", value: totals.ads, icon: Target },
            { label: "Chats started", value: totals.chats, icon: MessageSquare },
            {
              label: "People reached",
              value: totals.people,
              icon: Users,
              hint: "Counted per ad: someone who came from two ads counts twice.",
            },
          ]}
        />
      )}

      <DataTable
        columns={columns}
        rows={ads ?? []}
        getRowKey={(ad) => ad.adKey}
        isLoading={!resolved || isLoading}
        error={error ? getErrorMessage(error, "Couldn't load your ads.") : undefined}
        onRowClick={setOpenAd}
        defaultSortKey="clicks"
        defaultSortDirection="desc"
        empty={
          <EmptyState
            icon={Target}
            title="No chats from ads yet"
            description={
              <>
                When someone taps a Click-to-WhatsApp ad or a boosted post with a WhatsApp button
                and messages you, the ad shows up here with everyone it brought in. Earlier ad
                chats on your numbers are already included.
              </>
            }
            hint="Run the ad from Meta Ads Manager with WhatsApp as the destination and pick this number."
          />
        }
      />

      <AdSheet accountId={accountId} ad={openAd} days={days} onClose={() => setOpenAd(null)} />
    </div>
  )
}

function AdSheet({
  accountId,
  ad,
  days,
  onClose,
}: {
  accountId: string | null
  ad: AdSummary | null
  days: number
  onClose: () => void
}) {
  const { data: clicks, isLoading, error } = useAdClicks(accountId, ad?.adKey, days)

  return (
    <Sheet open={Boolean(ad)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        {ad && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{adLabel(ad)}</SheetTitle>
              <SheetDescription>
                {ad.clicks} {ad.clicks === 1 ? "chat" : "chats"} from {ad.contacts}{" "}
                {ad.contacts === 1 ? "person" : "people"} · first on {formatDate(ad.firstClickAt)}
              </SheetDescription>
            </SheetHeader>

            {ad.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{ad.body}</p>}

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/dashboard/segments/new?starter=${encodeURIComponent(adStarterId(ad.adKey))}`}>
                  <Users className="mr-2 h-4 w-4" /> Build an audience
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/automation">
                  <Bot className="mr-2 h-4 w-4" /> Auto-reply to this ad
                </Link>
              </Button>
              {ad.sourceUrl && /^https?:\/\//i.test(ad.sourceUrl) && (
                <Button asChild size="sm" variant="ghost">
                  <a href={ad.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> View ad
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              For an auto-reply, add a rule with &ldquo;Someone messages from an ad&rdquo; and tick
              this ad.
            </p>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">People who messaged</h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : error ? (
                <p className="text-sm text-destructive">
                  {getErrorMessage(error, "Couldn't load who messaged from this ad.")}
                </p>
              ) : (clicks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody in this period.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {(clicks ?? []).map((click, index) => (
                    // waId + time can repeat (two ad messages in one second); the
                    // index keeps the key unique in a list that never reorders.
                    <ClickRow key={`${click.contactWaId}-${click.clickedAt}-${index}`} click={click} />
                  ))}
                </ul>
              )}
              {(clicks?.length ?? 0) >= 100 && (
                <p className="text-xs text-muted-foreground">Showing the latest 100.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * The ad's image. Meta's CDN urls are signed and expire, so an older ad's
 * thumbnail will 404; that falls back to the placeholder instead of a broken
 * image icon. Not next/image: the host is Meta's, and would need allowlisting.
 */
function AdThumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
  const safe = url && /^https:\/\//i.test(url) ? url : null
  if (!safe || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
        <Target className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safe}
      alt=""
      className="h-10 w-10 shrink-0 rounded-md border object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

function ClickRow({ click }: { click: AdClick }) {
  const who = click.contactName || `+${click.contactWaId}`
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{who}</p>
        <p className="text-xs text-muted-foreground">
          {click.contactName ? `+${click.contactWaId} · ` : ""}
          {formatDateTime(click.clickedAt)}
        </p>
      </div>
      {click.conversationId ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/dashboard/chat/${click.conversationId}`} aria-label={`Open the chat with ${who}`}>
            <MessageSquare className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Badge variant="outline">No chat</Badge>
      )}
    </li>
  )
}
