"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ContactPicker } from "@/components/contact-picker"
import {
  getSegment,
  listSegmentContacts,
  listCampaigns,
  addSegmentMembers,
  removeSegmentMembers,
  isSegmentGroup,
  type Campaign,
  type Contact,
  type Segment,
  type SegmentRules,
} from "@/services/api"
import { describeCondition } from "@/lib/segment-rules"

/**
 * Renders a rule tree as nested badge rows. Indentation carries the grouping:
 * flattening "(A and B) or C" into one line of badges would read as three
 * conditions joined by a single operator, which is a different audience.
 */
function RulesTree({
  group,
  campaignName,
  depth = 0,
}: {
  group: SegmentRules
  campaignName: (id: string) => string | undefined
  depth?: number
}) {
  const joiner = group.combinator === "and" ? "AND" : "OR"
  return (
    <div className={depth > 0 ? "rounded-md border border-dashed p-2" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        {group.conditions.map((node, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-xs font-semibold text-muted-foreground">{joiner}</span>}
            {isSegmentGroup(node) ? (
              <RulesTree group={node} campaignName={campaignName} depth={depth + 1} />
            ) : (
              <Badge variant="outline" className="text-sm font-normal py-1">
                {describeCondition(node, campaignName)}
              </Badge>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
import { useAccountId } from "@/hooks/use-account-id"

const PAGE_SIZE = 20

export default function SegmentDetailPage() {
  const params = useParams<{ segmentId: string }>()
  const segmentId = params.segmentId
  const router = useRouter()
  const { accountId, resolved } = useAccountId()

  const [segment, setSegment] = useState<Segment | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [members, setMembers] = useState<Contact[]>([])
  const [membersTotal, setMembersTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId || !segmentId) {
      if (resolved) setIsLoading(false)
      return
    }
    getSegment(segmentId, accountId)
      .then((res) => setSegment(res))
      .catch((err) => toast.error(getErrorMessage(err) || "Failed to load segment"))
      .finally(() => setIsLoading(false))
    // Campaign names for the rule chips ("replied to July Promo within 7 days")
    listCampaigns(accountId)
      .then((res) => {
        setCampaigns(Array.isArray(res) ? res : [])
      })
      .catch(() => {})
  }, [accountId, resolved, segmentId])

  const fetchMembers = useCallback(async () => {
    if (!accountId || !segmentId) return
    setMembersLoading(true)
    try {
      const res = await listSegmentContacts(segmentId, accountId, PAGE_SIZE, offset)
      setMembers(Array.isArray(res.items) ? res.items : [])
      setMembersTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load members")
    } finally {
      setMembersLoading(false)
    }
  }, [accountId, segmentId, offset])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // Static membership edits. Both calls are rejected server-side on a dynamic
  // segment, so the controls only render for a static one.
  const handleAddMembers = async () => {
    if (!accountId || pendingIds.length === 0) return
    setIsAdding(true)
    try {
      const res = await addSegmentMembers(segmentId, accountId, pendingIds)
      toast.success(
        res.skipped
          ? `Added ${res.added}, skipped ${res.skipped} already on the list`
          : `Added ${res.added} contact${res.added === 1 ? "" : "s"}`
      )
      setShowAddMembers(false)
      setPendingIds([])
      fetchMembers()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to add contacts")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (contact: Contact) => {
    if (!accountId) return
    setRemovingId(contact.id)
    try {
      await removeSegmentMembers(segmentId, accountId, [contact.id])
      toast.success(`Removed ${contact.name || contact.waId}`)
      fetchMembers()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to remove contact")
    } finally {
      setRemovingId(null)
    }
  }

  if (!resolved || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!segment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/segments")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to segments
        </Button>
        <p className="text-muted-foreground">Segment not found.</p>
      </div>
    )
  }

  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name
  const isStatic = segment.type === "static"
  const from = membersTotal === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, membersTotal)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/segments")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to segments
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{segment.name}</h2>
            {segment.description && <p className="text-muted-foreground">{segment.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`/dashboard/segments/${segment.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button onClick={() => router.push(`/dashboard/campaigns?segment=${segment.id}`)}>
              <Megaphone className="mr-2 h-4 w-4" /> Create campaign from this segment
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{segment.type === "static" ? "Membership" : "Rules"}</CardTitle>
          <CardDescription>
            {segment.type === "static" ? (
              "A fixed list — membership only changes when someone is added or removed."
            ) : (
              <>
                Contacts matching {segment.rules?.combinator === "and" ? "ALL" : "ANY"} of these
                conditions, re-evaluated every time the segment is used.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {segment.rules ? (
            <RulesTree group={segment.rules} campaignName={campaignName} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {segment.memberCount} contact{segment.memberCount === 1 ? "" : "s"} on this list.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Members
              </CardTitle>
              <CardDescription>
                {membersTotal} member{membersTotal === 1 ? "" : "s"} —{" "}
                {isStatic ? "a fixed list you manage" : "evaluated live"}. Only opted-in members
                receive campaigns.
              </CardDescription>
            </div>
            {isStatic && (
              <Button variant="outline" onClick={() => setShowAddMembers(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add contacts
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  {isStatic && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No contacts match this segment right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">+{c.waId}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-48">
                          {(c.tags || []).map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.optedIn ? (
                          <Badge className="bg-success-soft text-success hover:bg-success-soft">
                            Opted in
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Opted out</Badge>
                        )}
                      </TableCell>
                      {isStatic && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removingId === c.id}
                            onClick={() => handleRemoveMember(c)}
                            title="Remove from this list"
                          >
                            {removingId === c.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {membersTotal > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {from}–{to} of {membersTotal}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || membersLoading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= membersTotal || membersLoading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showAddMembers}
        onOpenChange={(open) => {
          setShowAddMembers(open)
          if (!open) setPendingIds([])
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add contacts to {segment.name}</DialogTitle>
            <DialogDescription>
              Opted-out contacts can be on the list — they just won&apos;t receive campaigns.
            </DialogDescription>
          </DialogHeader>
          {accountId && (
            <ContactPicker
              accountId={accountId}
              selectedIds={pendingIds}
              onChange={setPendingIds}
              // Everyone on the current page is already a member; ticking them
              // again would be a no-op the server silently skips.
              excludeIds={members.map((m) => m.id)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMembers(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button onClick={handleAddMembers} disabled={pendingIds.length === 0 || isAdding}>
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {pendingIds.length || ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
