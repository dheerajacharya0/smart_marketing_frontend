"use client"

import { reportSilent, swallow } from "@/lib/observability"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getErrorMessage } from "@/lib/errors"
import {
  FileUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  UserX,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Explain } from "@/components/explain"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFacebookAccounts,
  listContacts,
  listContactTags,
  deleteContact,
  optInContact,
  optOutContact,
  type Contact,
} from "@/services/api"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { InsightBanner } from "@/components/insight-banner"
import { BulkConsentDialog } from "@/components/contacts/bulk-consent-dialog"
import { CONTACTS_PAGE_SIZE, useContacts } from "@/hooks/use-queries"
import { contactsInsight, type ContactsInsightInput } from "@/lib/insights"
import { optStatusTooltip, optedOutViaStop } from "@/lib/contact-consent"
import { cn } from "@/lib/utils"
import { ContactFormDialog } from "./contact-form-dialog"
import { CsvImportDialog } from "./csv-import-dialog"

// Shared with the nav prefetcher so a hover warms the exact key this page reads.
const PAGE_SIZE = CONTACTS_PAGE_SIZE

type OptedFilter = "all" | "in" | "out"

/** Two letters for the phone list's avatar: initials, or the number's last two digits. */
function contactInitials(contact: { name?: string | null; waId: string }) {
  const words = (contact.name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return contact.waId.slice(-2)
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
}

export default function ContactsPage() {
  const router = useRouter()
  const [accountId, setAccountId] = useState<string | null>(null)
  /** Why there's no account, once we know — null while still resolving. */
  const [accountBlocked, setAccountBlocked] = useState<
    "signed-out" | "none-linked" | "lookup-failed" | null
  >(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [optedFilter, setOptedFilter] = useState<OptedFilter>("all")
  const [showBulkConsent, setShowBulkConsent] = useState(false)
  // Bumped to re-run the account-wide reach read below, which is otherwise
  // fired once per account and would keep reporting the pre-consent numbers.
  const [reachNonce, setReachNonce] = useState(0)
  const refreshReach = () => setReachNonce((n) => n + 1)
  const [offset, setOffset] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [busyContactId, setBusyContactId] = useState<string | null>(null)
  // The phone list's "Delete" lives in a menu, which closes before a confirm
  // could open inside it — so the confirm is one dialog at page level.
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [reach, setReach] = useState<ContactsInsightInput | null>(null)
  const [consentConfirmContact, setConsentConfirmContact] = useState<Contact | null>(null)

  // Deep links from the command palette (?new=1, ?import=1) and from the
  // campaign wizard's blocked audience step (?opted=out, which lands on the
  // view where consent can be recorded). Read off window.location instead of
  // useSearchParams — this page has no Suspense boundary, and useSearchParams
  // without one breaks the production build.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("new") === "1") setShowForm(true)
    if (params.get("import") === "1") setShowImport(true)
    const opted = params.get("opted")
    if (opted === "out" || opted === "in") setOptedFilter(opted)
    if (params.has("new") || params.has("import") || params.has("opted")) {
      window.history.replaceState(null, "", "/dashboard/contacts")
    }
  }, [])

  // Resolve the current account: active WhatsApp context first, otherwise
  // fall back to the first linked Facebook account (contacts don't require a
  // registered phone number, just an account).
  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      // Every exit from here leaves `accountId` null, which disables Add
      // Contact and Import CSV. Record *why*, because "no account linked yet"
      // and "the lookup failed" are the same dead buttons otherwise, and the
      // second one looks like the feature is broken.
      if (!user?.id) {
        setAccountBlocked("signed-out")
        return
      }
      try {
        const ctx = await getActiveWhatsappContext()
        if (ctx) {
          setAccountId(ctx.accountId)
          return
        }
        const accounts = await getFacebookAccounts()
        const fbAccount = (accounts || []).find((a) => a.type === "facebook")
        if (fbAccount) {
          setAccountId(fbAccount.id)
          return
        }
        setAccountBlocked("none-linked")
      } catch (err) {
        reportSilent(err, { source: "app/dashboard/contacts/page.tsx", step: "resolve-account" })
        setAccountBlocked("lookup-failed")
      }
    }
    init()
  }, [])

  // Debounce search input (300ms) and reset to page 1 on change
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // The filters are the cache key, so paging back to a page already fetched is
  // served from cache instead of re-requesting it.
  const contactFilters = useMemo(
    () => ({
      search: search || undefined,
      optedIn: optedFilter === "all" ? undefined : optedFilter === "in",
      limit: PAGE_SIZE,
      offset,
    }),
    [search, optedFilter, offset],
  )
  const { data, isLoading, error, refetch } = useContacts(accountId, contactFilters)
  const contacts: Contact[] = useMemo(
    () => (Array.isArray(data?.items) ? data.items : []),
    [data],
  )
  const total = data?.total ?? 0

  // Phone list: pages gather as you scroll instead of replacing each other.
  // A page that comes back again (a refetch after opting someone in) updates
  // its rows in place, so a gathered row is never staler than the table's.
  // Page one starts over, which is also what every filter change resets to.
  const [gathered, setGathered] = useState<Contact[]>([])
  useEffect(() => {
    if (!data) return
    setGathered((prev) => {
      if (offset === 0) return contacts
      const fresh = new Map(contacts.map((contact) => [contact.id, contact]))
      const merged = prev.map((contact) => fresh.get(contact.id) ?? contact)
      const known = new Set(prev.map((contact) => contact.id))
      return [...merged, ...contacts.filter((contact) => !known.has(contact.id))]
    })
  }, [data, contacts, offset])
  const loadMore = useCallback(() => {
    setOffset((current) => current + PAGE_SIZE)
  }, [])
  const loadError = error ? getErrorMessage(error, "Failed to load contacts") : null

  const fetchContacts = useCallback(() => {
    refetch()
  }, [refetch])

  // Account-wide counts for the insight banner. `total` above follows the
  // current filter, so it can't answer "how much of the list is unreachable" —
  // these are two `limit: 1` reads for their `total`, fired once per account
  // rather than on every search keystroke.
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    Promise.all([
      listContacts(accountId, { limit: 1 }),
      listContacts(accountId, { optedIn: true, limit: 1 }),
      listContactTags(accountId).catch(() => []),
    ])
      .then(([all, optedIn, tags]) => {
        if (cancelled) return
        setReach({
          total: all.total ?? 0,
          optedInTotal: optedIn.total ?? 0,
          hasTags: Array.isArray(tags) ? tags.length > 0 : undefined,
        })
      })
      // A missing count means no banner, which is the correct failure: the
      // list itself is on screen and unaffected.
      .catch(swallow("app/dashboard/contacts/page.tsx"))
    return () => {
      cancelled = true
    }
  }, [accountId, reachNonce])

  const insight = useMemo(() => (reach ? contactsInsight(reach) : null), [reach])

  const performToggleOptIn = async (contact: Contact) => {
    if (!accountId) return
    setBusyContactId(contact.id)
    try {
      if (contact.optedIn) {
        await optOutContact(contact.id, accountId)
        toast.success(`${contact.name || contact.waId} opted out`)
      } else {
        await optInContact(contact.id, accountId)
        toast.success(`${contact.name || contact.waId} opted in`)
      }
      fetchContacts()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update opt-in status")
    } finally {
      setBusyContactId(null)
    }
  }

  const handleToggleOptIn = (contact: Contact) => {
    // STOP unsubscribes need an explicit consent confirmation before re-opt-in
    if (optedOutViaStop(contact)) {
      setConsentConfirmContact(contact)
      return
    }
    performToggleOptIn(contact)
  }

  const handleDelete = async (contact: Contact) => {
    if (!accountId) return
    setBusyContactId(contact.id)
    try {
      await deleteContact(contact.id, accountId)
      toast.success("Contact deleted")
      setGathered((prev) => prev.filter((row) => row.id !== contact.id))
      // If this was the only row on the last page, step back a page
      if (contacts.length === 1 && offset > 0) {
        setOffset(offset - PAGE_SIZE)
      } else {
        fetchContacts()
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to delete contact")
    } finally {
      setBusyContactId(null)
    }
  }

  const openCreate = () => {
    setEditingContact(null)
    setShowForm(true)
  }

  const openEdit = (contact: Contact) => {
    setEditingContact(contact)
    setShowForm(true)
  }

  const formatPhone = (waId: string) => `+${waId}`
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

  const hasFilters = !!search || optedFilter !== "all"
  const showEmptyState = !isLoading && accountId && total === 0 && !hasFilters

  // Columns carry their own mobile role, so the same definition renders as a
  // table on desktop and as cards on a phone — see components/data-table.tsx.
  const columns: Column<Contact>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      sortValue: (c) => c.name || formatPhone(c.waId),
      cell: (contact) => (
        // The row and the phone card both open the profile now; this stays a
        // real link so it keeps middle-click, "open in new tab" and a visible
        // target. On a phone it was the *only* way in, at 18px tall — under
        // the 24px minimum — because the card carried no handler of its own.
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {contact.name || (
            <span className="text-muted-foreground">{formatPhone(contact.waId)}</span>
          )}
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      card: "meta",
      sortValue: (c) => c.waId,
      className: "whitespace-nowrap",
      cell: (contact) => <span className="font-mono text-sm">{formatPhone(contact.waId)}</span>,
      // An unnamed contact's title is already the number; don't say it twice.
      cardCell: (contact) =>
        contact.name ? <span className="font-mono">{formatPhone(contact.waId)}</span> : null,
    },
    {
      key: "tags",
      header: "Tags",
      className: "hide-on-lg",
      cardCell: (contact) =>
        (contact.tags || []).length === 0 ? null : (
          <div className="flex flex-wrap gap-1">
            {(contact.tags || []).map((tag) => (
              <Badge key={tag} variant="outline" className="px-1.5 py-0 text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ),
      cell: (contact) =>
        (contact.tags || []).length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <div className="flex max-w-48 flex-wrap gap-1">
            {(contact.tags || []).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "status",
      header: (
        <>
          Status <Explain term="opt-in" />
        </>
      ),
      cardLabel: "Status",
      // The phone list shows this as the dot on the avatar instead.
      card: "hidden",
      sortValue: (c) => (c.optedIn ? 0 : 1),
      cell: (contact) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                {contact.optedIn ? (
                  <Badge className="bg-success-soft text-success hover:bg-success-soft">Opted in</Badge>
                ) : (
                  <Badge variant="secondary">Opted out</Badge>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>{optStatusTooltip(contact)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      key: "added",
      header: "Added",
      sortValue: (c) => c.createdAt,
      className: "whitespace-nowrap hide-on-md",
      card: "hidden",
      cell: (contact) => (
        <span className="text-sm text-muted-foreground">{formatDate(contact.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      // Three icon buttons per row made each phone card as tall as a paragraph;
      // the phone list gets the same actions in one menu ("menu" below).
      card: "hidden",
      cell: (contact) => (
        // The row/card opens the profile, so every control in here has to
        // stop the click before it reaches that handler — including the
        // confirm dialog, which Radix portals but React still bubbles
        // through this subtree. Same guard the segments list uses.
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            title={
              optedOutViaStop(contact)
                ? "This contact unsubscribed by texting STOP. They must text START to re-subscribe."
                : contact.optedIn
                  ? "Opt out"
                  : "Opt in"
            }
            disabled={busyContactId === contact.id}
            className={optedOutViaStop(contact) ? "opacity-50" : undefined}
            onClick={() => handleToggleOptIn(contact)}
          >
            {busyContactId === contact.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : contact.optedIn ? (
              <UserX className="h-3.5 w-3.5" />
            ) : (
              <UserCheck className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(contact)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                title="Delete"
                disabled={busyContactId === contact.id}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {contact.name || formatPhone(contact.waId)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the contact permanently and can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(contact)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
    {
      key: "menu",
      header: "",
      // Phone list only: the table has the "actions" column above.
      className: "hidden",
      card: "actions",
      cell: (contact) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${contact.name || formatPhone(contact.waId)}`}
              disabled={busyContactId === contact.id}
            >
              {busyContactId === contact.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openEdit(contact)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={optedOutViaStop(contact)}
              onSelect={() => handleToggleOptIn(contact)}
            >
              {contact.optedIn ? (
                <UserX className="mr-2 h-4 w-4" />
              ) : (
                <UserCheck className="mr-2 h-4 w-4" />
              )}
              {optedOutViaStop(contact) ? "Opted out by STOP" : contact.optedIn ? "Opt out" : "Opt in"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteTarget(contact)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // Both header buttons are dead without an account, so the hover text has to
  // say which kind of dead it is.
  const blockedReason = accountId
    ? undefined
    : accountBlocked === "lookup-failed"
      ? "Couldn't check your linked accounts — reload the page."
      : accountBlocked === "signed-out"
        ? "Your session expired. Sign in again."
        : accountBlocked === "none-linked"
          ? "Link a WhatsApp Business or Facebook account first."
          : "Checking your linked accounts…"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage your WhatsApp audience — tags, attributes and opt-in status."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setShowImport(true)}
              disabled={!accountId}
              title={blockedReason}
            >
              <FileUp className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={openCreate} disabled={!accountId} title={blockedReason}>
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
          </>
        }
      />

      <InsightBanner insight={insight} />

      <Card>
        <CardHeader>
          <CardTitle>All contacts</CardTitle>
          <CardDescription>
            {total > 0 ? `${total.toLocaleString()} contact${total === 1 ? "" : "s"}` : "Your contact list"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showEmptyState ? (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Add your first contact or import an existing list from CSV."
              action={
                <>
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add contact
                  </Button>
                  <Button variant="outline" onClick={() => setShowImport(true)}>
                    <FileUp className="mr-2 h-4 w-4" /> Import CSV
                  </Button>
                </>
              }
              hint="You can only message people who opted in. Importing a list does not opt them in — consent has to come from them."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={contacts}
              getRowKey={(contact) => contact.id}
              onRowClick={(contact) => router.push(`/dashboard/contacts/${contact.id}`)}
              mobileLayout="list"
              mobileLeading={(contact) => (
                <span className="relative block">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                      contact.optedIn ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {contactInitials(contact)}
                  </span>
                  {/* Consent as a presence dot: green can be messaged, grey can't. */}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
                      contact.optedIn ? "bg-success" : "bg-muted-foreground/50",
                    )}
                    title={contact.optedIn ? "Opted in" : "Opted out"}
                  >
                    <span className="sr-only">{contact.optedIn ? "Opted in" : "Opted out"}</span>
                  </span>
                </span>
              )}
              isLoading={isLoading}
              skeletonRows={6}
              error={
                loadError ? (
                  <EmptyState
                    plain
                    icon={Users}
                    title="Couldn't load your contacts"
                    description={`${loadError}. Nobody has been removed — this is a problem reading the list.`}
                    action={
                      <Button variant="outline" onClick={fetchContacts}>
                        Try again
                      </Button>
                    }
                  />
                ) : undefined
              }
              // The list is paged server-side, so client-side sorting would
              // only reorder the twenty rows currently on screen.
              disableSorting
              toolbar={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or phone…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={optedFilter}
                    onValueChange={(v) => {
                      setOptedFilter(v as OptedFilter)
                      setOffset(0)
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All contacts</SelectItem>
                      <SelectItem value="in">Opted in</SelectItem>
                      <SelectItem value="out">Opted out</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Only offered against an explicitly opted-out view. Scoping
                      it to whatever filter happens to be active would let "all
                      contacts" mean "opt everyone in", which is the exact
                      mistake this flow exists to make hard. */}
                  {optedFilter === "out" && total > 0 && (
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setShowBulkConsent(true)}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Record consent
                      <span className="ml-1 text-muted-foreground">({total.toLocaleString()})</span>
                    </Button>
                  )}
                </div>
              }
              empty={
                !accountId ? (
                  accountBlocked === "lookup-failed" ? (
                    <EmptyState
                      plain
                      icon={TriangleAlert}
                      title="Couldn't check your linked accounts"
                      description="Contacts need an account to belong to, and that lookup failed — so adding and importing are switched off. This is a connection problem, not a missing account."
                      action={
                        <Button variant="outline" onClick={() => window.location.reload()}>
                          Reload
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      plain
                      icon={Users}
                      title="No connected account yet"
                      description="Link a Facebook or WhatsApp Business account before adding contacts."
                      action={
                        <Button asChild>
                          <Link href="/dashboard/whatsapp/new">Connect an account</Link>
                        </Button>
                      }
                    />
                  )
                ) : (
                  <EmptyState
                    plain
                    icon={Search}
                    title="No contacts match your filters"
                    description="Try a different search term, or clear the opt-in filter."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchInput("")
                          setOptedFilter("all")
                          setOffset(0)
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                )
              }
              mobileInfinite={{
                rows: gathered,
                hasMore: gathered.length < total,
                loadingMore: isLoading && offset > 0,
                onLoadMore: loadMore,
              }}
              pagination={{
                offset,
                pageSize: PAGE_SIZE,
                total,
                onOffsetChange: setOffset,
                noun: "contact",
              }}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!consentConfirmContact}
        onOpenChange={(open) => {
          if (!open) setConsentConfirmContact(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-subscribe {consentConfirmContact?.name || consentConfirmContact?.waId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This contact unsubscribed by texting STOP. They must text START to re-subscribe. Manually
              opting them back in against their explicit request is a compliance risk — only continue if
              they have given you consent outside WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const contact = consentConfirmContact
                setConsentConfirmContact(null)
                if (contact) performToggleOptIn(contact)
              }}
            >
              I have their consent — opt in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget ? deleteTarget.name || formatPhone(deleteTarget.waId) : "contact"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the contact permanently and can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {accountId && (
        <>
          <ContactFormDialog
            open={showForm}
            onOpenChange={setShowForm}
            accountId={accountId}
            contact={editingContact}
            onSaved={fetchContacts}
          />
          <CsvImportDialog
            open={showImport}
            onOpenChange={setShowImport}
            accountId={accountId}
            onImported={fetchContacts}
          />
          <BulkConsentDialog
            open={showBulkConsent}
            onOpenChange={setShowBulkConsent}
            accountId={accountId}
            filters={{ search: search || undefined, optedIn: false }}
            matchingTotal={total}
            scopeLabel={search ? `opted out, matching “${search}”` : "opted out"}
            onComplete={() => {
              fetchContacts()
              // The account-wide reach counts drive the banner above, and they
              // are read once per account — without this the page still claims
              // everyone is unreachable right after fixing it.
              refreshReach()
            }}
          />
        </>
      )}
    </div>
  )
}
