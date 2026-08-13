"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import {
  ChevronLeft,
  ChevronRight,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { ContactFormDialog } from "./contact-form-dialog"
import { CsvImportDialog } from "./csv-import-dialog"

const PAGE_SIZE = 20

type OptedFilter = "all" | "in" | "out"

const OPT_IN_SOURCE_LABELS: Record<string, string> = {
  api: "Manually",
  csv_import: "CSV import",
  whatsapp_keyword: "WhatsApp keyword",
}

// Contact unsubscribed themselves by texting STOP â€” manual re-opt-in is a
// compliance risk and goes through an explicit consent confirmation.
function optedOutViaStop(contact: Contact): boolean {
  return !contact.optedIn && contact.optInSource === "whatsapp_keyword"
}

function formatOptTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function optStatusTooltip(contact: Contact): string {
  if (contact.optedIn) {
    const source = contact.optInSource ? OPT_IN_SOURCE_LABELS[contact.optInSource] : null
    const when = formatOptTimestamp(contact.optedInAt)
    return `Opted in${source ? ` via ${source}` : ""}${when ? ` â€” ${when}` : ""}`
  }
  const when = formatOptTimestamp(contact.optedOutAt)
  if (optedOutViaStop(contact)) {
    return `Opted out via WhatsApp (texted STOP)${when ? ` â€” ${when}` : ""}`
  }
  return `Opted out${when ? ` â€” ${when}` : ""}`
}

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

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)
  const hasFilters = !!search || optedFilter !== "all"
  const showEmptyState = !isLoading && accountId && total === 0 && !hasFilters

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage your WhatsApp audience â€” tags, attributes and opt-in status."
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
          <CardTitle>All Contacts</CardTitle>
          <CardDescription>
            {total > 0 ? `${total} contact${total === 1 ? "" : "s"}` : "Your contact list"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
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

          {showEmptyState ? (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Add your first contact or import an existing list from CSV."
              action={
                <>
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Contact
                  </Button>
                  <Button variant="outline" onClick={() => setShowImport(true)}>
                    <FileUp className="mr-2 h-4 w-4" /> Import CSV
                  </Button>
                </>
              }
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                            <span className="text-sm text-muted-foreground">Loading contacts...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : !accountId ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No connected account yet â€” link a Facebook/WhatsApp account first.
                        </TableCell>
                      </TableRow>
                    ) : contacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No contacts match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contact.name || <span className="text-muted-foreground">â€”</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatPhone(contact.waId)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-48">
                              {(contact.tags || []).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-help">
                                    {contact.optedIn ? (
                                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                                        Opted in
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">Opted out</Badge>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{optStatusTooltip(contact)}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(contact.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
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
                                    <AlertDialogTitle>
                                      Delete {contact.name || formatPhone(contact.waId)}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This removes the contact permanently and can't be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(contact)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {total > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {from}â€“{to} of {total}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || isLoading}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + PAGE_SIZE >= total || isLoading}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
              opting them back in against their explicit request is a compliance risk â€” only continue if
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
              I have their consent â€” opt in
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
