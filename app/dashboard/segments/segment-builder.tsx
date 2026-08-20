"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Plus, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import {
  createSegment,
  updateSegment,
  previewSegment,
  listContacts,
  getContactAttributeKeys,
  listContactTags,
  listCampaigns,
  type Campaign,
  type Contact,
  type Segment,
  type SegmentPreviewResult,
  type SegmentType,
} from "@/services/api"
import { ContactPicker } from "@/components/contact-picker"
import {
  MAX_TOTAL_CONDITIONS,
  type GroupDraft,
  countConditions,
  emptyCondition,
  fromApiGroup,
  groupErrors,
  parseRulesErrorIndex,
  toApiGroup,
} from "@/lib/segment-rules"
import { RuleGroupEditor } from "./rule-group-editor"
import type { SegmentStarter } from "@/lib/segment-starters"

const PREVIEW_DEBOUNCE_MS = 500
const PREVIEW_SAMPLE_LIMIT = 10

export function SegmentBuilder({
  accountId,
  segment,
  starter,
}: {
  accountId: string
  segment?: Segment | null
  /**
   * Pre-fills a new segment from `lib/segment-starters.ts`. Kept separate from
   * `segment` on purpose: passing a synthetic segment would flip `isEdit`, and
   * the builder would try to PATCH a segment that doesn't exist yet. Ignored
   * when editing.
   */
  starter?: SegmentStarter | null
}) {
  const router = useRouter()
  const isEdit = !!segment
  const seed = isEdit ? null : starter

  const [name, setName] = useState(segment?.name || seed?.name || "")
  const [description, setDescription] = useState(segment?.description || seed?.description || "")
  /**
   * Immutable after creation — the server refuses a change, and rightly: going
   * dynamic → static would have to freeze a live query into a list, and static →
   * dynamic would have to invent rules that reproduce a hand-picked one.
   */
  const [segmentType, setSegmentType] = useState<SegmentType>(segment?.type ?? "dynamic")
  /** Static segments only: the initial membership, chosen at creation. */
  const [memberIds, setMemberIds] = useState<string[]>([])
  const isStatic = segmentType === "static"
  // One tree, nestable. A saved segment from before nesting is a group with no
  // nesting, so it loads unchanged; starters are flat by construction.
  const [rootGroup, setRootGroup] = useState<GroupDraft>(() => {
    if (segment?.rules?.conditions?.length) return fromApiGroup(segment.rules)
    if (seed?.conditions.length) {
      return { combinator: seed.combinator || "and", conditions: seed.conditions.map((c) => ({ ...c })) }
    }
    return { combinator: seed?.combinator || "and", conditions: [emptyCondition()] }
  })

  const [attributeKeys, setAttributeKeys] = useState<string[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const [preview, setPreview] = useState<SegmentPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  // Rules signature the current preview belongs to — save requires a match.
  const [previewedSignature, setPreviewedSignature] = useState<string | null>(null)
  const previewSeq = useRef(0)

  const [isSaving, setIsSaving] = useState(false)
  const [serverRowError, setServerRowError] = useState<{ index: number | null; message: string } | null>(null)

  // Attribute keys and tags both come from dedicated server-side aggregates,
  // complete across every contact. The contact sample below is only a fallback
  // for attribute keys if that endpoint fails. Campaign options feed the
  // campaign-behavior condition.
  useEffect(() => {
    getContactAttributeKeys(accountId)
      .then((keys) => {
        if (Array.isArray(keys)) setAttributeKeys([...new Set(keys)].sort())
      })
      .catch(() => {})
    listContactTags(accountId)
      .then((tags) => {
        // Server order is by usage; keep it, so the tag most contacts carry is
        // the first one offered rather than whatever sorts alphabetically.
        if (Array.isArray(tags)) setKnownTags(tags.map((t) => t.tag))
      })
      .catch(() => {})
    listContacts(accountId, { limit: 100 })
      .then((res) => {
        const items: Contact[] = Array.isArray(res.items) ? res.items : []
        const keys = new Set<string>()
        for (const c of items) {
          Object.keys(c.attributes || {}).forEach((k) => keys.add(k))
        }
        // Merge sample-derived keys in case the endpoint is unavailable.
        setAttributeKeys((prev) => [...new Set([...prev, ...keys])].sort())
      })
      .catch(() => {})
    listCampaigns(accountId)
      .then((res) => {
        setCampaigns(Array.isArray(res) ? res : [])
      })
      .catch(() => {})
  }, [accountId])

  // Every problem in the tree, including group-level ones (an empty group, a
  // breached cap) — the server rejects the whole rule set, so a row-only check
  // would let the preview 400 with nothing marked.
  const ruleErrors = useMemo(() => groupErrors(rootGroup), [rootGroup])
  const rulesValid = ruleErrors.length === 0
  const rulesSignature = useMemo(
    () => (rulesValid ? JSON.stringify(toApiGroup(rootGroup)) : null),
    [rulesValid, rootGroup]
  )

  // Debounced live preview — only when every row is complete, and stale
  // responses are discarded via a sequence counter. A static segment has no
  // rules to preview: its membership is the list you picked.
  useEffect(() => {
    if (isStatic) return
    if (!rulesSignature) {
      setPreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    const timer = setTimeout(() => {
      previewSegment(accountId, JSON.parse(rulesSignature), PREVIEW_SAMPLE_LIMIT)
        .then((res) => {
          if (seq !== previewSeq.current) return
          setPreview(res ?? null)
          setPreviewError(null)
          setPreviewedSignature(rulesSignature)
          setServerRowError(null)
        })
        .catch((err) => {
          if (seq !== previewSeq.current) return
          const message = getErrorMessage(err) || "Preview failed"
          setPreviewError(message)
          setPreview(null)
          const index = parseRulesErrorIndex(message)
          if (index != null) setServerRowError({ index, message })
        })
        .finally(() => {
          if (seq === previewSeq.current) setPreviewLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [rulesSignature, accountId, isStatic])

  const updateRootGroup = (next: GroupDraft) => {
    setServerRowError(null)
    setRootGroup(next)
  }

  const canSave = isStatic
    ? // A static segment can start empty — contacts are added later on the
      // segment page — so only the name gates saving.
      !!name.trim()
    : !!name.trim() &&
      rulesValid &&
      !!rulesSignature &&
      previewedSignature === rulesSignature &&
      !previewLoading

  const handleSave = async () => {
    if (!canSave) return
    if (!isStatic && !rulesSignature) return
    setIsSaving(true)
    setServerRowError(null)
    try {
      const rules = rulesSignature ? JSON.parse(rulesSignature) : undefined
      if (isEdit && segment) {
        await updateSegment(segment.id, {
          accountId,
          name: name.trim(),
          description: description.trim() || undefined,
          // Membership, not rules, defines a static segment — sending rules
          // for one is a 400.
          ...(isStatic ? {} : { rules }),
        })
        toast.success("Segment updated")
      } else {
        await createSegment({
          accountId,
          name: name.trim(),
          description: description.trim() || undefined,
          type: segmentType,
          // Exactly one of these: rules define a dynamic segment, a contact
          // list defines a static one, and the server refuses both or neither.
          ...(isStatic ? { contactIds: memberIds } : { rules }),
        })
        toast.success("Segment created")
      }
      router.push("/dashboard/segments")
    } catch (err) {
      const message = getErrorMessage(err) || "Failed to save segment"
      const index = parseRulesErrorIndex(message)
      if (index != null) {
        setServerRowError({ index, message })
      } else {
        toast.error(message)
      }
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/segments")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to segments
        </Button>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">{isEdit ? "Edit Segment" : "New Segment"}</h2>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Segment"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="segment-name">Name</Label>
                <Input
                  id="segment-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VIPs in Pune"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segment-description">Description (optional)</Label>
                <Input
                  id="segment-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High-value customers in Pune, active recently"
                />
              </div>

              <div className="grid gap-2">
                <Label>Kind</Label>
                {isEdit ? (
                  <p className="text-sm text-muted-foreground">
                    {isStatic ? "Fixed list" : "Rules-based"} — a segment&apos;s kind can&apos;t be
                    changed after it&apos;s created.
                  </p>
                ) : (
                  <>
                    <Tabs
                      value={segmentType}
                      onValueChange={(v) => setSegmentType(v as SegmentType)}
                    >
                      <TabsList>
                        <TabsTrigger value="dynamic">Rules-based</TabsTrigger>
                        <TabsTrigger value="static">Fixed list</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <p className="text-xs text-muted-foreground">
                      {isStatic
                        ? "You pick the contacts. Membership only changes when you add or remove someone."
                        : "Membership is re-evaluated every time the segment is used, so it keeps up as contacts change."}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {isStatic && !isEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>
                  Pick who starts on this list. You can add or remove people afterwards from the
                  segment page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactPicker
                  accountId={accountId}
                  selectedIds={memberIds}
                  onChange={setMemberIds}
                />
              </CardContent>
            </Card>
          )}

          <Card className={isStatic ? "hidden" : undefined}>
            <CardHeader>
              <CardTitle>Conditions</CardTitle>
              <CardDescription>
                Membership is evaluated live every time the segment is used. Group conditions to
                mix AND and OR — “(A and B) or C”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <datalist id="segment-attr-keys">
                {attributeKeys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>

              <RuleGroupEditor
                group={rootGroup}
                onChange={updateRootGroup}
                options={{ attributeKeys, knownTags, campaigns }}
                serverError={serverRowError?.message ?? null}
              />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  {ruleErrors.slice(0, 3).map((message) => (
                    <p key={message} className="text-xs text-destructive">
                      {message}
                    </p>
                  ))}
                </div>
                <Badge variant="outline">
                  {countConditions(rootGroup)}/{MAX_TOTAL_CONDITIONS} conditions
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Evaluated live, nothing saved yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isStatic ? (
              // Nothing to evaluate: a fixed list is its own answer, and a
              // "preview" of it would just echo the picker above.
              <p className="text-sm text-muted-foreground">
                {memberIds.length === 0
                  ? "No contacts picked yet. You can also add them after saving."
                  : `${memberIds.length} contact${memberIds.length === 1 ? "" : "s"} on this list.`}
              </p>
            ) : !rulesValid ? (
              <p className="text-sm text-muted-foreground">
                Complete every condition row to see matching contacts.
              </p>
            ) : previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Evaluating…
              </div>
            ) : previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : preview ? (
              <>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">
                    Matches <span className="font-semibold">{preview.total}</span> contact
                    {preview.total === 1 ? "" : "s"}
                  </p>
                </div>
                {preview.sample.length > 0 && (
                  <div className="rounded-md border overflow-x-auto">
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
                        {preview.sample.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm font-medium">{c.name || "—"}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">+{c.waId}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-32">
                                {(c.tags || []).slice(0, 3).map((t) => (
                                  <Badge key={t} variant="outline" className="text-xs">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {c.optedIn ? (
                                <Badge className="bg-success-soft text-success hover:bg-success-soft">
                                  In
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Out</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
