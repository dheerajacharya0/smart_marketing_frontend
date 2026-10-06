"use client"

import { swallow } from "@/lib/observability"
import { useQuery } from "@tanstack/react-query"
import { getErrorMessage } from "@/lib/errors"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import { TokenHealthBanners } from "@/components/token-health-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, MessageSquare } from "lucide-react"
import { QualityBadge, messagingTierLabel } from "@/components/quality-badge"
import { Explain } from "@/components/explain"
import { pickAccountNumbers } from "@/lib/account-numbers"
import { coexistenceSyncState, type CoexistenceSyncState } from "@/lib/coexistence-sync"
import { CoexistenceSyncBanners } from "@/components/coexistence-sync-banner"
import {
  getFacebookAccounts,
  type FacebookAccount,
  type WhatsappPhoneNumber,
  getUserDataFromCookie,
  listWhatsappPhoneNumbers,
  syncBusiness,
  getWhatsappBusinessAccount,
} from "@/services/api"

/**
 * One row per connected number. The list used to be one row per Facebook
 * login with every other number squeezed into an "Also:" line, so a second
 * business on the same login (its own display name, quality and limit) read
 * as if it wasn't connected at all.
 */
interface NumberRow {
  key: string
  account: FacebookAccount
  /** The number's WhatsApp display name, else the account's name. */
  name: string
  phoneNumber: string | null
  wabaId?: string
  phoneNumberId?: string
  createdAt?: string
  qualityRating: string | null
  messagingTier: string | null
  qualityUpdatedAt: string | null
  addedBy?: WhatsappPhoneNumber["addedBy"]
  /** Also on the WhatsApp Business app (Meta coexistence). */
  coexistence?: boolean
  coexistenceSync: CoexistenceSyncState
  /** False for a login that has no registered number yet. */
  hasNumber: boolean
}

interface AccountsData {
  accounts: FacebookAccount[]
  rows: NumberRow[]
}

export default function WhatsAppBusinessPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")

  // Kept in the page rather than hooks/use-queries.ts: this is not a read, it
  // is an orchestration — a list, then a sync and a phone-number lookup per
  // account, with a live Meta fallback when our copy of the number is stale.
  // What it gains from `useQuery` is that a failure is now an error rather than
  // an empty list, on the screen that answers "is WhatsApp connected at all".
  const loadAccounts = useCallback(async (): Promise<AccountsData> => {
    const user = getUserDataFromCookie()
    if (!user?.id) return { accounts: [], rows: [] }

    const accountsList = await getFacebookAccounts()
    const accounts = (accountsList || []).filter((a) => a.type === "facebook")
    const perAccount = await Promise.all(
      accounts.map(async (account): Promise<NumberRow[]> => {
        const bare: NumberRow = {
          key: account.id,
          account,
          name: account.name || "—",
          phoneNumber: null,
          qualityRating: null,
          messagingTier: account.messagingLimit ?? null,
          qualityUpdatedAt: null,
          coexistenceSync: { kind: "none" },
          hasNumber: false,
        }
        try {
          // Refresh our DB copy from Meta first — display name/number on
          // the phone number record can be stale/null if it was never
          // synced after registration.
          // Not for an account Meta has already rejected: the sync can
          // only 401 again, and the reconnect banner above says why.
          if (!account.needsReauth) {
            await syncBusiness(account.id).catch(swallow("app/dashboard/whatsapp/page.tsx"))
          }
          const numbers = await listWhatsappPhoneNumbers(account.id)
          const { primary, others } = pickAccountNumbers(
            account.whatsappBusinessDetails?.phoneNumberId,
            numbers
          )
          if (!primary) return [bare]

          let primaryDigits = primary.displayPhoneNumber ?? null
          // Our DB copy can be stale/never-synced (null) — fall back to a
          // live Meta lookup, same call step-4's confirmation page uses
          // successfully to show the real number.
          // Skipped for a rejected login: Meta can only refuse again.
          if (!primaryDigits && !account.needsReauth) {
            try {
              const wabaRes = await getWhatsappBusinessAccount(account.id)
              const waba = (wabaRes?.data || []).find((w) => w.id === primary.wabaId)
              primaryDigits = waba?.details?.display_phone_number || null
            } catch (err) {
              console.log("live waba lookup err", account.id, err)
            }
          }

          return [primary, ...others].map((n) => {
            const isPrimary = n === primary
            return {
              key: `${account.id}:${n.phoneNumberId}`,
              account,
              name: n.verifiedName || account.name || "—",
              phoneNumber: isPrimary ? primaryDigits : (n.displayPhoneNumber ?? null),
              wabaId: n.wabaId,
              phoneNumberId: n.phoneNumberId,
              createdAt: n.createdAt,
              qualityRating: n.qualityRating ?? null,
              // Per-number tier comes only from a quality webhook; until one
              // arrives, the portfolio limit stands in — but that limit is
              // stored for the main number's portfolio only.
              messagingTier: n.messagingTier ?? (isPrimary ? (account.messagingLimit ?? null) : null),
              qualityUpdatedAt: n.qualityUpdatedAt ?? null,
              addedBy: n.addedBy,
              coexistence: n.coexistence,
              coexistenceSync: coexistenceSyncState(n),
              hasNumber: true,
            }
          })
        } catch (err) {
          console.log("phone numbers fetch err", account.id, err)
          return [bare]
        }
      }),
    )
    return { accounts, rows: perAccount.flat() }
  }, [])

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["whatsapp-accounts"],
    queryFn: loadAccounts,
  })
  const accounts = data?.accounts ?? []
  const rows = data?.rows ?? []
  const loadError = error
    ? getErrorMessage(error, "Couldn't load your connected accounts")
    : null

  const needle = searchTerm.trim().toLowerCase()
  const filteredRows = needle
    ? rows.filter((row) =>
        [row.name, row.phoneNumber, row.account.name, row.addedBy?.name, row.addedBy?.email].some((v) =>
          v?.toLowerCase().includes(needle)
        )
      )
    : rows

  const getStatusBadge = (row: NumberRow) => {
    // `status` is set once at signup and never learns the Facebook login
    // died; needsReauth does, so it wins.
    if (row.account.needsReauth) return <Badge variant="destructive">Reconnect needed</Badge>
    switch (row.account.status) {
      case "verified":
        return <Badge className="bg-primary">Verified</Badge>
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>
      default:
        return <Badge variant="outline">{row.account.status || "N/A"}</Badge>
    }
  }

  const tierBadge = (row: NumberRow) =>
    messagingTierLabel(row.messagingTier) ? (
      <Badge variant="outline">{messagingTierLabel(row.messagingTier)}</Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    )

  const qualityBadge = (row: NumberRow) =>
    row.hasNumber ? (
      <QualityBadge rating={row.qualityRating} updatedAt={row.qualityUpdatedAt} />
    ) : (
      <span className="text-muted-foreground">—</span>
    )

  const addedBy = (row: NumberRow) =>
    row.addedBy ? (
      <span title={row.addedBy.email}>{row.addedBy.name || row.addedBy.email}</span>
    ) : (
      // Numbers connected before the backend recorded this have no answer —
      // say so rather than guessing the account owner.
      <span className="text-muted-foreground">{row.hasNumber ? "Not recorded" : "—"}</span>
    )

  const businessAppBadge = (row: NumberRow) =>
    row.coexistence ? (
      <Badge variant="outline" className="ml-2 whitespace-nowrap font-normal" title="Also used on the WhatsApp Business app">
        Business app
      </Badge>
    ) : null

  const addedOn = (row: NumberRow) =>
    row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"

  const actionsMenu = (row: NumberRow) => {
    const { account } = row
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              if (account.status === "verified") {
                const query = new URLSearchParams({
                  wabaId: row.wabaId || "",
                  phoneNumberId: row.phoneNumberId || "",
                })
                router.push(`/dashboard/whatsapp/${account.id}/step-4?${query.toString()}`)
              } else {
                router.push(`/dashboard/whatsapp/${account.id}/step-1`)
              }
            }}
          >
            {account.status === "verified" ? "View Setup" : "Continue Setup"}
          </DropdownMenuItem>
          {row.hasNumber ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  const query = new URLSearchParams({ wabaId: row.wabaId || "" })
                  router.push(`/dashboard/whatsapp/${account.id}/templates?${query.toString()}`)
                }}
              >
                Manage Templates
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/whatsapp/${account.id}/details`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/dashboard/whatsapp/${account.id}/edit`)}>
                Edit Account
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem className="text-destructive">Delete Account</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Shared by the phone list and the desktop table.
  const listStatus = isLoading ? (
    <div className="flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
      <span className="text-sm text-muted-foreground">Loading accounts...</span>
    </div>
  ) : loadError ? (
    // Was a swallowed `console.log` and an empty table, on the screen that
    // answers whether WhatsApp is connected at all — a connected number
    // reading as "no accounts" is the one wrong answer this page must not give.
    <>
      <p className="text-sm text-muted-foreground">{loadError}. Any connected number is unaffected.</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
        Try again
      </Button>
    </>
  ) : filteredRows.length === 0 ? (
    <p className="text-sm text-muted-foreground">No WhatsApp Business accounts found.</p>
  ) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">WhatsApp Business</h2>
        <div className="flex flex-wrap gap-2">
          {/* Embedded Signup unconfigured: "New Integration" below already
              leads to the OAuth path, so no fallback link is needed here. */}
          <ConnectWhatsAppButton
            label="Connect WhatsApp"
            onSuccess={() => refetch()}
            unconfiguredFallback="hide"
          />
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/whatsapp/new")}
          >
            <Plus className="mr-2 h-4 w-4" /> New Integration
          </Button>
        </div>
      </div>

      {/* Feature 2 — token-health re-link prompts */}
      <TokenHealthBanners accounts={accounts} onReconnected={() => refetch()} />

      <CoexistenceSyncBanners
        items={rows
          .filter((row) => row.phoneNumberId)
          .map((row) => ({
            key: row.key,
            accountId: row.account.id,
            phoneNumberId: row.phoneNumberId as string,
            label: row.phoneNumber ? `${row.name} (${row.phoneNumber})` : row.name,
            state: row.coexistenceSync,
          }))}
        onRetried={() => refetch()}
      />

      <Card className="whatsapp-card">
        <CardHeader>
          <CardTitle>WhatsApp Business Accounts</CardTitle>
          <CardDescription>Every connected number, with who added it.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6 w-full md:w-2/3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search name, number or person…"
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {listStatus ? (
            <div className="flex min-h-24 flex-col items-center justify-center rounded-md border p-4 text-center">
              {listStatus}
            </div>
          ) : (
            <>
              {/* Phones get cards: seven columns squeezed the number onto
                  three lines and pushed everything else off-screen. */}
              <ul className="space-y-3 md:hidden">
                {filteredRows.map((row) => (
                  <li key={row.key} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center font-medium">
                          <span className="truncate">{row.name}</span>
                          {businessAppBadge(row)}
                        </p>
                        <p className="whitespace-nowrap text-sm text-muted-foreground">
                          {row.phoneNumber || (row.hasNumber ? "Number not available" : "No number yet")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {getStatusBadge(row)}
                        {actionsMenu(row)}
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Quality</dt>
                      <dd>{qualityBadge(row)}</dd>
                      <dt className="text-muted-foreground">Daily limit</dt>
                      <dd>{tierBadge(row)}</dd>
                      <dt className="text-muted-foreground">Added by</dt>
                      <dd className="min-w-0 truncate">{addedBy(row)}</dd>
                      <dt className="text-muted-foreground">Added on</dt>
                      <dd>{addedOn(row)}</dd>
                    </dl>
                  </li>
                ))}
              </ul>

              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        Business Name
                        <Explain term="display-name" />
                      </TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>
                        Status
                        <Explain term="business-verification" />
                      </TableHead>
                      <TableHead>
                        Quality
                        <Explain term="quality-rating" />
                      </TableHead>
                      <TableHead>
                        Daily Limit
                        <Explain term="messaging-tier" />
                      </TableHead>
                      <TableHead>Added by</TableHead>
                      <TableHead>Added on</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">
                          {row.name}
                          {businessAppBadge(row)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.phoneNumber || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(row)}</TableCell>
                        <TableCell>{qualityBadge(row)}</TableCell>
                        <TableCell>{tierBadge(row)}</TableCell>
                        <TableCell>{addedBy(row)}</TableCell>
                        <TableCell className="whitespace-nowrap">{addedOn(row)}</TableCell>
                        <TableCell className="text-right">{actionsMenu(row)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {!isLoading && !loadError && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-accent p-3 mb-3">
                <MessageSquare className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No WhatsApp Business accounts found</h3>
              <p className="text-sm text-muted-foreground mt-1">Get started by creating a new WhatsApp integration</p>
              <Button
                className="mt-4 bg-primary hover:bg-primary/90"
                onClick={() => router.push("/dashboard/whatsapp/new")}
              >
                <Plus className="mr-2 h-4 w-4" /> New Integration
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
