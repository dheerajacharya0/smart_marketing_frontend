"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Megaphone, Pencil, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "react-hot-toast"
import {
  getSegment,
  listSegmentContacts,
  listCampaigns,
  type Campaign,
  type Contact,
  type Segment,
} from "@/services/api"
import { describeCondition } from "@/lib/segment-rules"
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
  const combinatorLabel = segment.rules.combinator === "and" ? "AND" : "OR"
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
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Contacts matching {segment.rules.combinator === "and" ? "ALL" : "ANY"} of these conditions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {segment.rules.conditions.map((condition, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-xs font-semibold text-muted-foreground">{combinatorLabel}</span>}
                <Badge variant="outline" className="text-sm font-normal py-1">
                  {describeCondition(condition, campaignName)}
                </Badge>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Members
          </CardTitle>
          <CardDescription>
            {membersTotal} member{membersTotal === 1 ? "" : "s"} — evaluated live. Only opted-in members
            receive campaigns.
          </CardDescription>
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
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                            Opted in
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Opted out</Badge>
                        )}
                      </TableCell>
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
    </div>
  )
}
