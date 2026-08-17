"use client"

import { useEffect, useMemo, useState } from "react"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { ChevronDown, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { TemplateHeaderMediaField } from "@/components/template-header-media-field"
import { templateHeaderMediaFormat } from "@/lib/whatsapp-template"
import { toast } from "react-hot-toast"
import {
  listWhatsappTemplates,
  listContacts,
  listContactTags,
  getContactAttributeKeys,
  listSegments,
  createCampaign,
  type Contact,
  type Segment,
  type TemplateHeaderMedia,
  type WhatsappContext,
  type WhatsappTemplate,
} from "@/services/api"

const STEPS = ["Basics", "Parameters", "Audience", "Schedule & confirm"] as const

function templateBody(template: WhatsappTemplate): string {
  const body = (template?.components || []).find((c) => c.type === "BODY")
  return body?.text || ""
}

// Number of {{1}}..{{N}} body variables — highest index wins.
function countBodyVariables(bodyText: string): number {
  let max = 0
  for (const m of bodyText.matchAll(/\{\{(\d+)\}\}/g)) {
    max = Math.max(max, Number(m[1]))
  }
  return max
}

// Resolve personalization tokens against a sample contact for the live preview.
function resolveTokens(value: string, contact: Contact | null): string {
  return value.replace(/\{\{(name|waId|attributes\.([\w-]+))\}\}/g, (match, token, attrKey) => {
    if (!contact) return match
    if (token === "name") return contact.name || match
    if (token === "waId") return contact.waId
    if (attrKey) return contact.attributes?.[attrKey] ?? match
    return match
  })
}

export function NewCampaignDialog({
  open,
  onOpenChange,
  context,
  onCreated,
  initialSegmentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: WhatsappContext
  onCreated: () => void
  // Pre-select a segment audience ("Create campaign from this segment")
  initialSegmentId?: string
}) {
  const [step, setStep] = useState(0)

  // Step 1
  const [name, setName] = useState("")
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateName, setTemplateName] = useState("")

  // Step 2
  const [paramValues, setParamValues] = useState<string[]>([])
  const [sampleContact, setSampleContact] = useState<Contact | null>(null)
  const [attributeKeys, setAttributeKeys] = useState<string[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])

  // Step 3
  const [audienceMode, setAudienceMode] = useState<"all" | "tag" | "segment">("all")
  const [audienceTag, setAudienceTag] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [segments, setSegments] = useState<Segment[]>([])
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)

  // Step 4
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now")
  const [scheduledLocal, setScheduledLocal] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [headerMedia, setHeaderMedia] = useState<TemplateHeaderMedia | undefined>(undefined)
  const [trackLinks, setTrackLinks] = useState(false)

  const selectedTemplate = templates.find((t) => t.name === templateName) || null
  const bodyText = selectedTemplate ? templateBody(selectedTemplate) : ""
  const variableCount = countBodyVariables(bodyText)
  // Null unless the template was approved with an image/video/document header.
  const headerFormat = selectedTemplate ? templateHeaderMediaFormat(selectedTemplate) : null
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const reset = () => {
    setStep(0)
    setName("")
    setTemplateName("")
    setParamValues([])
    setAudienceMode("all")
    setAudienceTag("")
    setSegmentId("")
    setAudienceCount(null)
    setScheduleMode("now")
    setScheduledLocal("")
    setCreateError(null)
    setHeaderMedia(undefined)
    setTrackLinks(false)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) reset()
  }

  // Load approved templates + a sample of opted-in contacts (for tokens,
  // known tags, and the live preview) when the wizard opens.
  useEffect(() => {
    if (!open) return
    setTemplatesLoading(true)
    listWhatsappTemplates(context.accountId, context.wabaId)
      .then((res) => {
        setTemplates(Array.isArray(res) ? res.filter((t) => t.status === "APPROVED") : [])
      })
      .catch((err) => toast.error(getErrorMessage(err) || "Failed to load templates"))
      .finally(() => setTemplatesLoading(false))

    listSegments(context.accountId)
      .then((res) => {
        setSegments(Array.isArray(res) ? res : [])
      })
      .catch(() => {})
    if (initialSegmentId) {
      setAudienceMode("segment")
      setSegmentId(initialSegmentId)
    }

    getContactAttributeKeys(context.accountId)
      .then((keys) => {
        if (Array.isArray(keys)) setAttributeKeys([...new Set(keys)].sort())
      })
      .catch(() => {})
    // Complete tag list, server-side and ordered by usage. Picking an audience
    // tag from a 50-contact sample meant the tag you wanted was missing exactly
    // when the account was big enough for tagging to be worth doing.
    listContactTags(context.accountId)
      .then((tags) => {
        if (Array.isArray(tags)) setKnownTags(tags.map((t) => t.tag))
      })
      .catch(() => {})
    listContacts(context.accountId, { optedIn: true, limit: 50 })
      .then((res) => {
        const items: Contact[] = Array.isArray(res.items) ? res.items : []
        setSampleContact(items[0] || null)
        const keys = new Set<string>()
        for (const c of items) {
          Object.keys(c.attributes || {}).forEach((k) => keys.add(k))
        }
        // Merge sample-derived keys as a fallback if the endpoint is unavailable.
        setAttributeKeys((prev) => [...new Set([...prev, ...keys])].sort())
      })
      .catch(() => {
        // tokens/preview degrade gracefully without contacts
      })
  }, [open, context.accountId, context.wabaId, initialSegmentId])

  // Resize parameter inputs when the template changes
  useEffect(() => {
    setParamValues((prev) => {
      const next = [...prev.slice(0, variableCount)]
      while (next.length < variableCount) next.push("")
      return next
    })
  }, [variableCount, templateName])

  // Estimated audience size — total from a limit=1 opted-in contacts query.
  // Segment mode uses the segment's live memberCount instead (labeled
  // "members": it can include opted-out contacts; the backend filters them).
  useEffect(() => {
    if (!open || step !== 2) return
    if (audienceMode === "segment") {
      setAudienceCount(segments.find((s) => s.id === segmentId)?.memberCount ?? null)
      setAudienceLoading(false)
      return
    }
    if (audienceMode === "tag" && !audienceTag) {
      setAudienceCount(null)
      return
    }
    setAudienceLoading(true)
    listContacts(context.accountId, {
      optedIn: true,
      tag: audienceMode === "tag" ? audienceTag : undefined,
      limit: 1,
    })
      .then((res) => {
        setAudienceCount(res.total ?? 0)
      })
      .catch(() => setAudienceCount(null))
      .finally(() => setAudienceLoading(false))
  }, [open, step, audienceMode, audienceTag, segmentId, segments, context.accountId])

  const previewText = useMemo(() => {
    if (!bodyText) return ""
    return bodyText.replace(/\{\{(\d+)\}\}/g, (match, idx) => {
      const raw = paramValues[Number(idx) - 1]
      if (!raw) return match
      return resolveTokens(raw, sampleContact)
    })
  }, [bodyText, paramValues, sampleContact])

  const insertToken = (index: number, token: string) => {
    setParamValues((prev) => prev.map((v, i) => (i === index ? v + token : v)))
  }

  const stepValid = (): string | null => {
    if (step === 0) {
      if (!name.trim()) return "Campaign name is required"
      if (!templateName) return "Pick a template"
    }
    if (step === 1) {
      if (paramValues.some((v) => !v.trim())) return "Fill in all template parameters"
      // A media header isn't optional on a template approved with one: without
      // it every recipient fails identically at Meta, after the audience has
      // already been snapshotted.
      if (headerFormat && !headerMedia?.link && !headerMedia?.mediaId) {
        return `This template needs a header ${headerFormat}`
      }
    }
    if (step === 2) {
      if (audienceMode === "tag" && !audienceTag) return "Pick a tag"
      if (audienceMode === "segment" && !segmentId) return "Pick a segment"
      if (audienceMode !== "segment" && audienceCount === 0)
        return "No opted-in contacts match — campaign can't be created."
    }
    if (step === 3) {
      if (scheduleMode === "later") {
        if (!scheduledLocal) return "Pick a date and time"
        if (new Date(scheduledLocal).getTime() <= Date.now()) return "Scheduled time must be in the future"
      }
    }
    return null
  }

  const goNext = () => {
    const err = stepValid()
    if (err) {
      toast.error(err)
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleCreate = async () => {
    const err = stepValid()
    if (err) {
      toast.error(err)
      return
    }
    setCreateError(null)
    setIsCreating(true)
    try {
      await createCampaign({
        accountId: context.accountId,
        wabaId: context.wabaId,
        phoneNumberId: context.phoneNumberId,
        name: name.trim(),
        templateName,
        templateLanguage: selectedTemplate?.language || "en_US",
        ...(variableCount > 0 ? { templateParameters: paramValues } : {}),
        ...(headerFormat && headerMedia ? { headerMedia } : {}),
        ...(trackLinks ? { trackLinks: true } : {}),
        // audienceTag and segmentId are mutually exclusive
        ...(audienceMode === "tag" ? { audienceTag } : {}),
        ...(audienceMode === "segment" ? { segmentId } : {}),
        ...(scheduleMode === "later" ? { scheduledAt: new Date(scheduledLocal).toISOString() } : {}),
      })
      toast.success(scheduleMode === "later" ? "Campaign scheduled" : "Campaign started")
      handleOpenChange(false)
      onCreated()
    } catch (e) {
      // 400s (empty audience, past schedule) stay inline on the confirm step
      if (getErrorStatus(e) === 400) {
        setCreateError(getErrorMessage(e))
      } else {
        toast.error(getErrorMessage(e, "Failed to create campaign"))
      }
    } finally {
      setIsCreating(false)
    }
  }

  const selectedSegment = segments.find((s) => s.id === segmentId)
  const audienceLabel =
    audienceMode === "tag"
      ? `Tag: ${audienceTag}`
      : audienceMode === "segment"
        ? `Segment: ${selectedSegment?.name || segmentId}`
        : "All opted-in contacts"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="July Promo Blast"
              />
            </div>

            <div className="grid gap-2">
              <Label>Template</Label>
              <Select value={templateName} onValueChange={setTemplateName}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      templatesLoading
                        ? "Loading templates..."
                        : templates.length
                          ? "Select an approved template"
                          : "No approved templates yet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only approved templates can be sent as broadcasts.
              </p>
            </div>

            {selectedTemplate && (
              <div className="rounded-md border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Preview — language: {selectedTemplate.language}
                </p>
                <p className="text-sm whitespace-pre-wrap">{bodyText || "(no body text)"}</p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {headerFormat && (
              <TemplateHeaderMediaField
                format={headerFormat}
                value={headerMedia}
                onChange={setHeaderMedia}
                accountId={context.accountId}
                phoneNumberId={context.phoneNumberId}
                // A campaign resolves tokens once, at creation, against each
                // recipient — so a per-contact header URL genuinely works here.
                allowTokens
              />
            )}
            {variableCount === 0 && !headerFormat ? (
              <p className="text-sm text-muted-foreground">
                This template has no body variables — nothing to fill in.
              </p>
            ) : variableCount === 0 ? null : (
              <>
                <p className="text-sm text-muted-foreground">
                  Values for the template's {"{{1}}"}–{"{{"}
                  {variableCount}
                  {"}}"} variables. Static text or personalization tokens (resolved per contact).
                </p>
                {paramValues.map((value, i) => (
                  <div key={i} className="grid gap-2">
                    <Label htmlFor={`param-${i}`}>{`Variable {{${i + 1}}}`}</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`param-${i}`}
                        value={value}
                        onChange={(e) =>
                          setParamValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                        }
                        placeholder="Static text or token"
                        className="flex-1"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="shrink-0">
                            Insert token <ChevronDown className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => insertToken(i, "{{name}}")}>
                            Contact name — {"{{name}}"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => insertToken(i, "{{waId}}")}>
                            Phone — {"{{waId}}"}
                          </DropdownMenuItem>
                          {attributeKeys.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">Attributes</DropdownMenuLabel>
                              {attributeKeys.map((key) => (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() => insertToken(i, `{{attributes.${key}}}`)}
                                >
                                  {key} — {`{{attributes.${key}}}`}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </>
            )}

            {bodyText && (
              <div className="rounded-md border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Live preview
                  {sampleContact
                    ? ` — sample contact: ${sampleContact.name || sampleContact.waId}`
                    : " — no opted-in contact available for sampling"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{previewText}</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <RadioGroup value={audienceMode} onValueChange={(v) => setAudienceMode(v as typeof audienceMode)}>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="all" id="audience-all" />
                <Label htmlFor="audience-all" className="flex-1 cursor-pointer">
                  All opted-in contacts
                </Label>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="tag" id="audience-tag" />
                <Label htmlFor="audience-tag" className="cursor-pointer">
                  Contacts with tag
                </Label>
                <div className="flex-1">
                  {knownTags.length > 0 ? (
                    <Select
                      value={audienceTag}
                      onValueChange={(v) => {
                        setAudienceTag(v)
                        setAudienceMode("tag")
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {knownTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={audienceTag}
                      onChange={(e) => {
                        setAudienceTag(e.target.value.trim().toLowerCase())
                        setAudienceMode("tag")
                      }}
                      placeholder="tag name"
                      className="h-8"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="segment" id="audience-segment" />
                <Label htmlFor="audience-segment" className="cursor-pointer">
                  Segment
                </Label>
                <div className="flex-1">
                  <Select
                    value={segmentId}
                    onValueChange={(v) => {
                      setSegmentId(v)
                      setAudienceMode("segment")
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={segments.length ? "Select segment" : "No segments yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.memberCount ?? "?"} members)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </RadioGroup>

            <div className="rounded-md border bg-muted/50 p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              {audienceMode === "segment" ? (
                <span className="text-sm">
                  {selectedSegment ? (
                    <>
                      <span className="font-semibold">{selectedSegment.memberCount}</span> member
                      {selectedSegment.memberCount === 1 ? "" : "s"} — only opted-in members receive the
                      campaign.
                    </>
                  ) : (
                    <span className="text-muted-foreground">Pick a segment to see its member count.</span>
                  )}
                </span>
              ) : audienceLoading ? (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Estimating audience...
                </span>
              ) : audienceCount == null ? (
                <span className="text-sm text-muted-foreground">
                  {audienceMode === "tag" ? "Pick a tag to estimate audience size." : "Audience size unknown."}
                </span>
              ) : audienceCount === 0 ? (
                <span className="text-sm font-medium text-destructive">
                  No opted-in contacts match — campaign can't be created.
                </span>
              ) : (
                <span className="text-sm">
                  Estimated audience: <span className="font-semibold">{audienceCount}</span> opted-in contact
                  {audienceCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Only opted-in contacts are included. Contacts who text STOP are unsubscribed automatically.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <RadioGroup value={scheduleMode} onValueChange={(v) => setScheduleMode(v as "now" | "later")}>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="now" id="schedule-now" />
                <Label htmlFor="schedule-now" className="flex-1 cursor-pointer">
                  Send now
                </Label>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="later" id="schedule-later" />
                <Label htmlFor="schedule-later" className="cursor-pointer">
                  Schedule
                </Label>
                <div className="flex-1">
                  <Input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(e) => {
                      setScheduledLocal(e.target.value)
                      setScheduleMode("later")
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </RadioGroup>
            {scheduleMode === "later" && (
              <p className="text-xs text-muted-foreground">
                Times are in your timezone ({timezone}); sent to the server as UTC.
              </p>
            )}

            <Separator />

            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Track link clicks</p>
                <p className="text-xs text-muted-foreground">
                  Replaces any web address in your parameters with a short tracking link, so you
                  can see who clicked. It changes the address recipients see, which is why it&apos;s
                  off unless you ask for it.
                </p>
              </div>
              <Switch checked={trackLinks} onCheckedChange={setTrackLinks} />
            </div>

            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm font-medium">Summary</p>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Campaign</dt>
                  <dd className="font-medium">{name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Template</dt>
                  <dd>
                    {templateName} ({selectedTemplate?.language})
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Audience</dt>
                  <dd>
                    {audienceLabel}
                    {audienceCount != null ? ` — ~${audienceCount} contacts` : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Link tracking</dt>
                  <dd>{trackLinks ? "On" : "Off"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Schedule</dt>
                  <dd>
                    {scheduleMode === "now"
                      ? "Send immediately"
                      : scheduledLocal
                        ? new Date(scheduledLocal).toLocaleString()
                        : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
        )}

        <DialogFooter>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isCreating}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>Next</Button>
          ) : (
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {scheduleMode === "later" ? "Schedule Campaign" : "Send Campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
