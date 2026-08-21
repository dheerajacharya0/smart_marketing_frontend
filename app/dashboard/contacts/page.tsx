"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { getErrorMessage } from "@/lib/errors"
import {
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import { Explain } from "@/components/explain"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFacebookAccounts,
  listContacts,
  deleteContact,
  optInContact,
  optOutContact,
  type Contact,
} from "@/services/api"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { optStatusTooltip, optedOutViaStop } from "@/lib/contact-consent"
import { ContactFormDialog } from "./contact-form-dialog"
import { CsvImportDialog } from "./csv-import-dialog"

const PAGE_SIZE = 20

type OptedFilter = "all" | "in" | "out"

export default function ContactsPage() {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [optedFilter, setOptedFilter] = useState<OptedFilter>("all")
  const [offset, setOffset] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [busyContactId, setBusyContactId] = useState<string | null>(null)
  const [consentConfirmContact, setConsentConfirmContact] = useState<Contact | null>(null)

  // Deep links from the command palette: ?new=1 and ?import=1. Read off
  // window.location instead of useSearchParams — this page has no Suspense
  // boundary, and useSearchParams without one breaks the production build.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("new") === "1") setShowForm(true)
    if (params.get("import") === "1") setShowImport(true)
    if (params.has("new") || params.has("import")) {
      window.history.replaceState(null, "", "/dashboard/contacts")
    }
  }, [])

  // Resolve the current account: active WhatsApp context first, otherwise
  // fall back to the first linked Facebook account (contacts don't require a
  // registered phone number, just an account).
  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
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
        } else {
          setIsLoading(false)
        }
      } catch (err) {
        console.error("Failed to resolve account:", err)
        setIsLoading(false)
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

  const fetchContacts = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    try {
      const res = await listContacts(accountId, {
        search: search || undefined,
        optedIn: optedFilter === "all" ? undefined : optedFilter === "in",
        limit: PAGE_SIZE,
        offset,
      })
      setContacts(Array.isArray(res.items) ? res.items : [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load contacts")
    } finally {
      setIsLoading(false)
    }
  }, [accountId, search, optedFilter, offset])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

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
        // Name is the row's link to the profile. The whole row isn't
        // clickable on purpose — it already holds opt-in, edit and delete
        // controls, and a row-level click target would swallow them.
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
    },
    {
      key: "tags",
      header: "Tags",
      className: "hide-on-lg",
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
      cell: (contact) => (
        <span className="text-sm text-muted-foreground">{formatDate(contact.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
      cell: (contact) => (
        <div className="flex justify-end gap-1">
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
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage your WhatsApp audience — tags, attributes and opt-in status."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowImport(true)} disabled={!accountId}>
              <FileUp className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={openCreate} disabled={!accountId}>
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
          </>
        }
      />

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
              isLoading={isLoading}
              skeletonRows={6}
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
                </div>
              }
              empty={
                !accountId ? (
                  <EmptyState
                    plain
                    icon={Users}
                    title="No connected account yet"
                    description="Link a Facebook or WhatsApp Business account before adding contacts."
                  />
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
        </>
      )}
    </div>
  )
}
