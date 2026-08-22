"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, SearchX, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable, type Column } from "@/components/data-table"
import { StatStrip } from "@/components/stat-strip"
import { EmptyState } from "@/components/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import {
  createSegment,
  updateSegment,
  previewSegment,
  type Campaign,
  type Contact,
  type Segment,
  type SegmentPreviewResult,
  type SegmentType,
} from "@/services/api"
import { ContactPicker } from "@/components/contact-picker"
import {
  useCampaigns,
  useContactAttributeKeys,
  useContactTags,
  useContacts,
} from "@/hooks/use-queries"
import {
  MAX_TOTAL_CONDITIONS,
  type GroupDraft,
  countConditions,
  describeGroup,
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


  const [preview, setPreview] = useState<SegmentPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  // Rules signature the current preview belongs to — save requires a match.
  const [previewedSignature, setPreviewedSignature] = useState<string | null>(null)
  const previewSeq = useRef(0)

  const [isSaving, setIsSaving] = useState(false)
  const [serverRowError, setServerRowError] = useState<{ index: number | null; message: string } | null>(null)

  // Attribute keys and tags both come from dedicated server-side aggregates,
  // complete across every contact. The contact sample is only a fallback for
  // attribute keys if that endpoint fails. Campaign options feed the
  // campaign-behavior condition.
  //
  // All four are shared hooks, so opening this builder from the segments list
  // — or after the drip builder, which asks for the same vocabulary — reuses
  // what is already cached instead of refetching it per builder.
  const { data: attributeKeysData } = useContactAttributeKeys(accountId)
  const { data: contactSample } = useContacts(accountId, { limit: 100 })
  const { data: tagsData } = useContactTags(accountId)
  const { data: campaignsData } = useCampaigns(accountId)

  // Server order for tags is by usage; kept, so the tag most contacts carry is
  // the first one offered rather than whatever sorts alphabetically.
  const knownTags: string[] = useMemo(
    () => (Array.isArray(tagsData) ? tagsData.map((t) => t.tag) : []),
    [tagsData],
  )
  const campaigns: Campaign[] = useMemo(
    () => (Array.isArray(campaignsData) ? campaignsData : []),
    [campaignsData],
  )
  const attributeKeys: string[] = useMemo(() => {
    const keys = new Set<string>(Array.isArray(attributeKeysData) ? attributeKeysData : [])
    const items: Contact[] = Array.isArray(contactSample?.items) ? contactSample.items : []
    for (const c of items) {
      Object.keys(c.attributes || {}).forEach((k) => keys.add(k))
    }
    return [...keys].sort()
  }, [attributeKeysData, contactSample])

  // Every problem in the tree, including group-level ones (an empty group, a
  // breached cap) — the server rejects the whole rule set, so a row-only check
  // would let the preview 400 with nothing marked.
  const ruleErrors = useMemo(() => groupErrors(rootGroup), [rootGroup])
  const rulesValid = ruleErrors.length === 0

  /**
   * The rule tree read back as one sentence.
   *
   * A row of dropdowns can be filled in correctly and still not say what the
   * user meant — especially once a nested group mixes AND with OR. This is the
   * line they can check before saving, and the only place the rule is stated
   * in language rather than in widgets. Only rendered while the tree is valid;
   * describing a half-finished condition would read as nonsense.
   */
  const ruleSentence = useMemo(() => {
    if (isStatic || !rulesValid) return null
    const nameOf = (id: string) => campaigns.find((c) => c.id === id)?.name
    return describeGroup(toApiGroup(rootGroup), nameOf)
  }, [isStatic, rulesValid, rootGroup, campaigns])

  const previewColumns: Column<Contact>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      cell: (contact) => <span className="font-medium">{contact.name || "—"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      card: "meta",
      className: "whitespace-nowrap",
      cell: (contact) => <span className="font-mono text-sm">+{contact.waId}</span>,
    },
    {
      key: "tags",
      header: "Tags",
      cardLabel: "Tags",
      className: "hide-on-lg",
      cell: (contact) => (
        <div className="flex max-w-32 flex-wrap gap-1">
          {(contact.tags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-xs">
              {t}
            </Badge>
          ))}
          {(contact.tags || []).length === 0 && <span className="text-sm text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Opt-in",
      cell: (contact) =>
        contact.optedIn ? (
          <Badge className="bg-success-soft text-success hover:bg-success-soft">In</Badge>
        ) : (
          <Badge variant="secondary">Out</Badge>
        ),
    },
  ]
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
          <CardContent className="space-y-4">
            {isStatic ? (
              // Nothing to evaluate: a fixed list is its own answer, and a
              // "preview" of it would just echo the picker above.
              <StatStrip
                stats={[
                  {
                    label: "On this list",
                    value: memberIds.length,
                    icon: Users,
                    hint:
                      memberIds.length === 0
                        ? "You can also add contacts after saving"
                        : "Changes only when you add or remove someone",
                  },
                ]}
              />
            ) : !rulesValid ? (
              <p className="text-sm text-muted-foreground">
                Complete every condition to see who matches.
              </p>
            ) : previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : (
              <>
                {/* The rule in words, above the number it produces. */}
                {ruleSentence && (
                  <p className="rounded-lg border border-border-subtle bg-surface-2/60 p-3 text-sm leading-relaxed">
                    <span className="text-muted-foreground">Contacts who </span>
                    <span className="font-medium">{ruleSentence}</span>
                  </p>
                )}

                <StatStrip
                  stats={[
                    {
                      label: "Matching contacts",
                      value: previewLoading ? "…" : (preview?.total ?? "—"),
                      icon: Users,
                      hint: previewLoading
                        ? "Evaluating"
                        : "Recounted every time the segment is used",
                    },
                  ]}
                />

                <DataTable
                  columns={previewColumns}
                  rows={preview?.sample ?? []}
                  getRowKey={(contact) => contact.id}
                  isLoading={previewLoading}
                  skeletonRows={3}
                  // The sample is a fixed handful the server picked, not a
                  // page — sorting it would suggest it is the whole audience.
                  disableSorting
                  empty={
                    <EmptyState
                      plain
                      icon={SearchX}
                      title="Nobody matches yet"
                      description="No contact meets all of these conditions. Loosen one, or switch the group to match any of them."
                    />
                  }
                />

                {preview != null && preview.total > preview.sample.length && (
                  <p className="text-xs text-muted-foreground">
                    Showing {preview.sample.length} of {preview.total} — a sample, not the
                    full audience.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
