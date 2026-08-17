"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { listContacts, type Contact } from "@/services/api"

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

/**
 * Search-and-tick contact chooser for anything that takes an explicit list.
 *
 * Selections are kept as whole contacts, not just ids, so a name still renders
 * after the search moves on — a list that shows "3 selected" but can't say who
 * is worse than no summary at all. Only the ids leave the component.
 */
export function ContactPicker({
  accountId,
  selectedIds,
  onChange,
  optedInOnly = false,
  /** Already on the list — shown ticked and disabled rather than hidden. */
  excludeIds = [],
}: {
  accountId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  optedInOnly?: boolean
  excludeIds?: string[]
}) {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Record<string, Contact>>({})

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setLoading(true)
    listContacts(accountId, {
      ...(search ? { search } : {}),
      ...(optedInOnly ? { optedIn: true } : {}),
      limit: PAGE_SIZE,
    })
      .then((res) => setContacts(Array.isArray(res.items) ? res.items : []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [accountId, search, optedInOnly])

  // Drop anything the parent removed behind our back (e.g. a reset).
  useEffect(() => {
    setSelected((prev) => {
      const next: Record<string, Contact> = {}
      for (const id of selectedIds) if (prev[id]) next[id] = prev[id]
      return next
    })
  }, [selectedIds])

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds])
  const selectedList = useMemo(() => Object.values(selected), [selected])

  const toggle = (contact: Contact) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[contact.id]) delete next[contact.id]
      else next[contact.id] = contact
      onChange(Object.keys(next))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or number"
          className="pl-8"
        />
      </div>

      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedList.map((contact) => (
            <Badge key={contact.id} variant="secondary" className="gap-1">
              {contact.name || contact.waId}
              <button type="button" onClick={() => toggle(contact)} aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setSelected({})
              onChange([])
            }}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : contacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search ? "No contacts match that search." : "No contacts yet."}
          </p>
        ) : (
          contacts.map((contact) => {
            const isExcluded = excluded.has(contact.id)
            return (
              <label
                key={contact.id}
                className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm ${
                  isExcluded ? "opacity-60" : "cursor-pointer hover:bg-accent"
                }`}
              >
                <Checkbox
                  checked={isExcluded || Boolean(selected[contact.id])}
                  disabled={isExcluded}
                  onCheckedChange={() => !isExcluded && toggle(contact)}
                />
                <span className="flex-1 truncate">
                  {contact.name || "(no name)"}{" "}
                  <span className="text-muted-foreground">{contact.waId}</span>
                </span>
                {isExcluded && <span className="text-xs text-muted-foreground">already on list</span>}
                {!contact.optedIn && (
                  <span className="text-xs text-muted-foreground">opted out</span>
                )}
              </label>
            )
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing the first {PAGE_SIZE} matches — search to narrow it down.
        {selectedList.length > 0 ? ` ${selectedList.length} selected.` : ""}
      </p>
    </div>
  )
}
