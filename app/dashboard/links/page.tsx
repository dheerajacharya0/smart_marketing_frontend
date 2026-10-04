"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Copy, Link2, Loader2, MousePointerClick, Plus, TriangleAlert } from "lucide-react"
import toast from "react-hot-toast"
import { copyToClipboard as copy } from "@/lib/copy-to-clipboard"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { Explain } from "@/components/explain"
import { PageHeader } from "@/components/page-header"
import { useAccountId } from "@/hooks/use-account-id"
import { useActiveNumber } from "@/hooks/use-active-number"
import { getErrorMessage } from "@/lib/errors"
import { formatDate } from "@/lib/format-date"
import { OPT_IN_KEYWORDS, buildOptInLink } from "@/lib/opt-in-link"
import { resolveSenderNumbers, type SenderNumber } from "@/lib/resolve-sender-numbers"
import { createTrackedLink, listTrackedLinks, type TrackedLink } from "@/services/api"

/**
 * Tracked links, and the one link that grows the list.
 *
 * `POST /links` and `GET /links` have existed on the backend the whole time
 * with nothing calling them from the UI, so campaign links could be minted but
 * never read, and no link could be made by hand.
 *
 * The opt-in builder is the reason this page leads with it rather than with a
 * URL field. Importing a list does not create consent, and neither does someone
 * messaging you — the backend creates inbound contacts opted *out* on purpose.
 * A `wa.me` link prefilled with a keyword is the only thing that turns a
 * stranger into a contact a campaign may reach, and it does it with their own
 * message as the record.
 */

export default function LinksPage() {
  const { accountId, resolved: accountResolved, error: accountError } = useAccountId()
  const { active } = useActiveNumber()
  const [usableNumbers, setUsableNumbers] = useState<SenderNumber[]>([])
  const [numbersResolved, setNumbersResolved] = useState(false)

  const [links, setLinks] = useState<TrackedLink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [numberId, setNumberId] = useState<string>("")
  const [keyword, setKeyword] = useState<string>(OPT_IN_KEYWORDS[0])
  const [destination, setDestination] = useState("")
  const [creating, setCreating] = useState<"optin" | "custom" | null>(null)

  const fetchLinks = useCallback(() => {
    if (!accountId) return
    setIsLoading(true)
    listTrackedLinks(accountId, 100, 0)
      .then((res) => {
        setLinks(Array.isArray(res.links) ? res.links : [])
        setLoadError(null)
      })
      // A failure here is not an empty list — say which, or the page claims you
      // have no links when the request simply didn't land.
      .catch((err) => setLoadError(getErrorMessage(err) || "Couldn't load your links"))
      .finally(() => setIsLoading(false))
  }, [accountId])

  useEffect(fetchLinks, [fetchLinks])

  // Resolving a display number can take a sync round-trip, so this owns its own
  // "resolved" flag — an empty list before it finishes is "still looking", not
  // "you have no number", and those two read very differently to someone who
  // just finished onboarding.
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setNumbersResolved(false)
    resolveSenderNumbers(accountId).then((found) => {
      if (cancelled) return
      setUsableNumbers(found)
      setNumbersResolved(true)
    })
    return () => {
      cancelled = true
    }
  }, [accountId])

  useEffect(() => {
    if (numberId || usableNumbers.length === 0) return
    // Default to the number being worked on, not the first one added.
    const preferred = usableNumbers.find((n) => n.phoneNumberId === active?.phoneNumberId)
    setNumberId((preferred ?? usableNumbers[0]).id)
  }, [usableNumbers, numberId, active?.phoneNumberId])

  const selectedNumber = usableNumbers.find((n) => n.id === numberId)
  const optInDestination = selectedNumber?.displayPhoneNumber
    ? buildOptInLink(selectedNumber.displayPhoneNumber, keyword)
    : null

  const create = async (dest: string, kind: "optin" | "custom") => {
    if (!accountId) return
    setCreating(kind)
    try {
      const link = await createTrackedLink({ accountId, destination: dest })
      copy(link.url, "Link")
      if (kind === "custom") setDestination("")
      fetchLinks()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't create the link")
    } finally {
      setCreating(null)
    }
  }

  const columns: Column<TrackedLink>[] = [
    {
      key: "url",
      header: "Short link",
      card: "title",
      cell: (link) => (
        <button
          type="button"
          onClick={() => copy(link.url, "Link")}
          className="inline-flex items-center gap-1.5 font-mono text-xs underline-offset-4 hover:underline"
          title="Copy this link"
        >
          {link.url}
          <Copy className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      ),
    },
    {
      key: "destination",
      header: "Goes to",
      card: "meta",
      className: "max-w-72 truncate hide-on-lg",
      cell: (link) => (
        <span className="text-sm text-muted-foreground">
          {/* A per-recipient campaign link and a hand-made one look identical
              in a list of URLs; the origin is what makes the row readable. */}
          {link.campaignId ? (
            <Badge variant="outline" className="mr-1.5 text-xs font-normal">
              Campaign
            </Badge>
          ) : null}
          {link.destination}
        </span>
      ),
    },
    {
      key: "clicks",
      header: "Clicks",
      cardLabel: "Clicks",
      sortValue: (l) => l.clickCount,
      cell: (link) => (
        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
          <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
          {link.clickCount}
        </span>
      ),
    },
    {
      key: "last",
      header: "Last click",
      cardLabel: "Last click",
      className: "whitespace-nowrap hide-on-md",
      sortValue: (l) => l.lastClickedAt ?? "",
      cell: (link) => (
        <span className="text-sm text-muted-foreground">{formatDate(link.lastClickedAt)}</span>
      ),
    },
  ]

  const blockedReason = accountId
    ? undefined
    : !accountResolved
      ? "Checking your linked accounts…"
      : accountError
        ? "Couldn't check your linked accounts — reload the page."
        : "Link a WhatsApp Business or Facebook account first."

  return (
    <div className="space-y-6">
      <PageHeader
        title="Links"
        description="Short links you can measure — and the one that grows your list."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Opt-in link
          </CardTitle>
          <CardDescription>
            Share this anywhere — a bio, a poster, a receipt. Tapping it opens WhatsApp with one
            word ready to send, and sending it is what records their{" "}
            <Explain term="opt-in">consent</Explain>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usableNumbers.length === 0 ? (
            <div className="flex gap-2.5 rounded-md border border-border-subtle p-3">
              {accountId && !numbersResolved ? (
                <>
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Finding your WhatsApp number…</p>
                </>
              ) : (
                <>
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {blockedReason ?? "No registered WhatsApp number on this account yet."}{" "}
                    <Link href="/dashboard/whatsapp" className="underline underline-offset-4">
                      Set up a number
                    </Link>{" "}
                    and the link builds itself.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="optin-number">Your number</Label>
                  <Select value={numberId} onValueChange={setNumberId}>
                    <SelectTrigger id="optin-number">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {usableNumbers.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.displayPhoneNumber}
                          {n.verifiedName ? ` — ${n.verifiedName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="optin-keyword">Word they send</Label>
                  <Select value={keyword} onValueChange={setKeyword}>
                    <SelectTrigger id="optin-keyword">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPT_IN_KEYWORDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* The backend only counts a keyword when it is the entire
                      message, so this is a fixed list rather than a text box —
                      "START — saw your poster" would record nothing. */}
                  <p className="text-xs text-muted-foreground">
                    Has to be sent on its own, so it isn&apos;t editable.
                  </p>
                </div>
              </div>

              {optInDestination && (
                <div className="rounded-md border border-border-subtle bg-muted/40 p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Opens WhatsApp to
                  </p>
                  <p className="break-all font-mono text-xs">{optInDestination}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => optInDestination && create(optInDestination, "optin")}
                  disabled={!optInDestination || creating !== null}
                >
                  {creating === "optin" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create &amp; copy tracked link
                </Button>
                {optInDestination && (
                  <Button variant="outline" onClick={() => copy(optInDestination, "WhatsApp link")}>
                    <Copy className="mr-2 h-4 w-4" /> Copy without tracking
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The tracked version counts how many people opened it, so you can tell a poster that
                got looked at from one that got used.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Track any link</CardTitle>
          <CardDescription>
            Wrap a page of your own to count clicks from WhatsApp. This measures traffic — it
            doesn&apos;t collect consent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              const dest = destination.trim()
              if (dest) create(dest, "custom")
            }}
          >
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="https://your-shop.example/offer"
              type="url"
              className="flex-1"
              disabled={!accountId}
            />
            <Button type="submit" variant="outline" disabled={!destination.trim() || creating !== null}>
              {creating === "custom" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create link
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All links</CardTitle>
          <CardDescription>
            Campaign sends mint one link per recipient, so a campaign with 500 people adds 500 rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={links}
            getRowKey={(link) => link.id}
            isLoading={isLoading}
            skeletonRows={4}
            error={
              loadError ? (
                <EmptyState
                  plain
                  icon={TriangleAlert}
                  title="Couldn't load your links"
                  description={`${loadError}. Nothing has been deleted — this is a problem reading the list.`}
                  action={
                    <Button variant="outline" onClick={fetchLinks}>
                      Try again
                    </Button>
                  }
                />
              ) : undefined
            }
            empty={
              <EmptyState
                plain
                icon={Link2}
                title="No links yet"
                description="Create an opt-in link above, or turn on link tracking when you send a campaign."
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
