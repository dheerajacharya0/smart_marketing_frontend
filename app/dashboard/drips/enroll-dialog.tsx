"use client"

import { useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Loader2, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { enrollDripContacts, listContacts, listContactTags, type Contact } from "@/services/api"

const NONE = "__none__"

export function EnrollDialog({
  open,
  onOpenChange,
  dripId,
  accountId,
  onEnrolled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dripId: string
  accountId: string
  onEnrolled?: () => void
}) {
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [selected, setSelected] = useState<Record<string, Contact>>({})
  const [tag, setTag] = useState<string>(NONE)
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [isEnrolling, setIsEnrolling] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch("")
    setSearchInput("")
    setSelected({})
    setTag(NONE)
  }, [open])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Enrolling a whole tag needs the account's real tag list, not the tags on
  // the 25 contacts this search happened to match — those two sets drifted
  // apart on every keystroke.
  useEffect(() => {
    if (!open) return
    listContactTags(accountId)
      .then((tags) => {
        if (Array.isArray(tags)) setKnownTags(tags.map((t) => t.tag))
      })
      .catch(() => {})
  }, [open, accountId])

  // Load opted-in contacts (only opted-in ever get drip messages)
  useEffect(() => {
    if (!open) return
    setLoadingContacts(true)
    listContacts(accountId, { optedIn: true, search: search || undefined, limit: 25 })
      .then((res) => {
        setContacts(Array.isArray(res.items) ? res.items : [])
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false))
  }, [open, accountId, search])

  const selectedList = useMemo(() => Object.values(selected), [selected])
  const canSubmit = selectedList.length > 0 || tag !== NONE

  const toggle = (contact: Contact) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[contact.id]) delete next[contact.id]
      else next[contact.id] = contact
      return next
    })
  }

  const handleEnroll = async () => {
    if (!canSubmit) return
    setIsEnrolling(true)
    try {
      const res = await enrollDripContacts(dripId, accountId, {
        ...(selectedList.length > 0 ? { contactIds: selectedList.map((c) => c.id) } : {}),
        ...(tag !== NONE ? { tag } : {}),
      })
      toast.success(
        `Enrolled ${res.enrolled ?? 0}, skipped ${res.skipped ?? 0} (already enrolled or not opted in).`
      )
      onOpenChange(false)
      onEnrolled?.()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to enroll")
    } finally {
      setIsEnrolling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll contacts</DialogTitle>
          <DialogDescription>
            Only opted-in contacts receive drip messages. Contacts already in this sequence are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tag enroll */}
          <div className="grid gap-2">
            <Label>All opted-in contacts with tag</Label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tag (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— none —</SelectItem>
                {knownTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Specific contacts */}
          <div className="grid gap-2">
            <Label>Specific contacts {selectedList.length > 0 && `(${selectedList.length} selected)`}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search opted-in contacts..."
                className="pl-9"
              />
            </div>
            <div className="rounded-md border max-h-56 overflow-y-auto divide-y">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No opted-in contacts found.</div>
              ) : (
                contacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-accent"
                  >
                    <Checkbox checked={!!selected[c.id]} onCheckedChange={() => toggle(c)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">+{c.waId}</p>
                    </div>
                    {(c.tags || []).slice(0, 2).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </label>
                ))
              )}
            </div>
            {/* selected chips that may be off the current search page */}
            {selectedList.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedList.map((c) => (
                  <Badge key={c.id} variant="secondary" className="text-xs">
                    {c.name || `+${c.waId}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnrolling}>
            Cancel
          </Button>
          <Button onClick={handleEnroll} disabled={!canSubmit || isEnrolling}>
            {isEnrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
