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
  listCampaigns,
  type Campaign,
  type Contact,
  type Segment,
  type SegmentPreviewResult,
} from "@/services/api"
import {
  MAX_CONDITIONS,
  CONDITION_TYPE_OPTIONS,
  FIELD_OPTIONS,
  type ConditionDraft,
  emptyCondition,
  fromApiCondition,
  buildRules,
  conditionError,
  conditionNeedsValue,
  normalizeOperator,
  operatorOptionsFor,
  parseRulesErrorIndex,
} from "@/lib/segment-rules"
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
  const [combinator, setCombinator] = useState<"and" | "or">(
    segment?.rules?.combinator || seed?.combinator || "and"
  )
  const [drafts, setDrafts] = useState<ConditionDraft[]>(() => {
    if (segment?.rules?.conditions?.length) return segment.rules.conditions.map(fromApiCondition)
    if (seed?.conditions.length) return seed.conditions.map((c) => ({ ...c }))
    return [emptyCondition()]
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

  // Attribute keys come from the dedicated distinct-keys endpoint (complete
  // across all contacts); tags are still derived from a contact sample (no
  // distinct-tags endpoint yet). Campaign options feed the campaign-behavior
  // condition.
  useEffect(() => {
    getContactAttributeKeys(accountId)
      .then((keys) => {
        if (Array.isArray(keys)) setAttributeKeys([...new Set(keys)].sort())
      })
      .catch(() => {})
    listContacts(accountId, { limit: 100 })
      .then((res) => {
        const items: Contact[] = Array.isArray(res.items) ? res.items : []
        const keys = new Set<string>()
        const tags = new Set<string>()
        for (const c of items) {
          Object.keys(c.attributes || {}).forEach((k) => keys.add(k))
          ;(c.tags || []).forEach((t) => tags.add(t))
        }
        // Merge sample-derived keys in case the endpoint is unavailable.
        setAttributeKeys((prev) => [...new Set([...prev, ...keys])].sort())
        setKnownTags([...tags].sort())
      })
      .catch(() => {})
    listCampaigns(accountId)
      .then((res) => {
        setCampaigns(Array.isArray(res) ? res : [])
      })
      .catch(() => {})
  }, [accountId])

  const rowErrors = drafts.map(conditionError)
  const rulesValid = drafts.length >= 1 && drafts.length <= MAX_CONDITIONS && rowErrors.every((e) => !e)
  const rulesSignature = useMemo(
    () => (rulesValid ? JSON.stringify(buildRules(combinator, drafts)) : null),
    [rulesValid, combinator, drafts]
  )

  // Debounced live preview — only when every row is complete, and stale
  // responses are discarded via a sequence counter.
  useEffect(() => {
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
  }, [rulesSignature, accountId])

  const updateDraft = (index: number, patch: Partial<ConditionDraft>) => {
    setServerRowError(null)
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? normalizeOperator({ ...d, ...patch }) : d))
    )
  }

  const canSave =
    !!name.trim() && rulesValid && !!rulesSignature && previewedSignature === rulesSignature && !previewLoading

  const handleSave = async () => {
    if (!canSave || !rulesSignature) return
    setIsSaving(true)
    setServerRowError(null)
    try {
      const rules = JSON.parse(rulesSignature)
      if (isEdit && segment) {
        await updateSegment(segment.id, {
          accountId,
          name: name.trim(),
          description: description.trim() || undefined,
          rules,
        })
        toast.success("Segment updated")
      } else {
        await createSegment({
          accountId,
          name: name.trim(),
          description: description.trim() || undefined,
          rules,
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

  const rowError = (index: number): string | null => {
    if (serverRowError && serverRowError.index === index) return serverRowError.message
    return rowErrors[index]
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conditions</CardTitle>
                  <CardDescription>Membership is evaluated live every time the segment is used.</CardDescription>
                </div>
                <Tabs value={combinator} onValueChange={(v) => setCombinator(v as "and" | "or")}>
                  <TabsList>
                    <TabsTrigger value="and">Match ALL (AND)</TabsTrigger>
                    <TabsTrigger value="or">Match ANY (OR)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <datalist id="segment-attr-keys">
                {attributeKeys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>

              {drafts.map((draft, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={draft.type} onValueChange={(v) => updateDraft(i, { type: v as ConditionDraft["type"] })}>
                      <SelectTrigger className="w-44 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {draft.type === "field" && (
                      <Select
                        value={draft.field}
                        onValueChange={(v) => updateDraft(i, { field: v as ConditionDraft["field"], value: "" })}
                      >
                        <SelectTrigger className="w-36 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {draft.type === "attribute" && (
                      <Input
                        value={draft.key}
                        onChange={(e) => updateDraft(i, { key: e.target.value })}
                        placeholder="key (e.g. city)"
                        list="segment-attr-keys"
                        className="w-36 h-9"
                      />
                    )}

                    {draft.type === "campaign" && (
                      <Select value={draft.event} onValueChange={(v) => updateDraft(i, { event: v as ConditionDraft["event"] })}>
                        <SelectTrigger className="w-32 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                          <SelectItem value="replied">Replied</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Select value={draft.operator} onValueChange={(v) => updateDraft(i, { operator: v })}>
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorOptionsFor(draft).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {draft.type === "field" && conditionNeedsValue(draft) && (
                      <Input
                        type={draft.field === "createdAt" ? "date" : "text"}
                        value={draft.value}
                        onChange={(e) => updateDraft(i, { value: e.target.value })}
                        placeholder="value"
                        className="w-44 h-9"
                      />
                    )}

                    {draft.type === "attribute" && conditionNeedsValue(draft) && (
                      <Input
                        value={draft.value}
                        onChange={(e) => updateDraft(i, { value: e.target.value })}
                        placeholder="value"
                        className="w-40 h-9"
                      />
                    )}

                    {draft.type === "tag" &&
                      (knownTags.length > 0 ? (
                        <Select value={draft.value} onValueChange={(v) => updateDraft(i, { value: v })}>
                          <SelectTrigger className="w-40 h-9">
                            <SelectValue placeholder="Select tag" />
                          </SelectTrigger>
                          <SelectContent>
                            {knownTags.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={draft.value}
                          onChange={(e) => updateDraft(i, { value: e.target.value.toLowerCase() })}
                          placeholder="tag"
                          className="w-40 h-9"
                        />
                      ))}

                    {(draft.type === "activity" || draft.type === "campaign") && (
                      <span className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={draft.days}
                          onChange={(e) => updateDraft(i, { days: e.target.value })}
                          className="w-20 h-9"
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </span>
                    )}

                    {draft.type === "campaign" && (
                      <Select
                        value={draft.campaignId || "any"}
                        onValueChange={(v) => updateDraft(i, { campaignId: v === "any" ? "" : v })}
                      >
                        <SelectTrigger className="w-44 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any campaign</SelectItem>
                          {campaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={drafts.length === 1}
                      onClick={() => {
                        setServerRowError(null)
                        setDrafts((prev) => prev.filter((_, idx) => idx !== i))
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {rowError(i) && <p className="text-xs text-destructive">{rowError(i)}</p>}
                </div>
              ))}

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={drafts.length >= MAX_CONDITIONS}
                  onClick={() => setDrafts((prev) => [...prev, emptyCondition()])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
                </Button>
                <Badge variant="outline">
                  {drafts.length}/{MAX_CONDITIONS} conditions
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
            {!rulesValid ? (
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
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
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
