"use client"

import { swallow } from "@/lib/observability"
import { useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { ChevronDown, Loader2, Plus, Reply, Users, X } from "lucide-react"
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
import { starterSegmentName, type CampaignStarter } from "@/lib/campaign-starters"
import { addLabel, MAX_CAMPAIGN_LABELS, suggestCampaignLabel } from "@/lib/campaign-labels"
import {
  addDays,
  buildRunTimes,
  checkPlan,
  describeWeekdays,
  localDateString,
  MAX_SERIES_RUNS,
  WEEKDAYS,
} from "@/lib/campaign-schedule"
import {
  FOLLOW_UP_FILTER_LABELS,
  FOLLOW_UP_FILTER_ORDER,
  type CampaignPrefill,
} from "@/lib/campaign-prefill"
import { CostEstimate, useCostEstimate } from "@/components/cost-estimate"
import { toast } from "react-hot-toast"
import {
  listWhatsappTemplates,
  listContacts,
  listContactTags,
  getContactAttributeKeys,
  listSegments,
  createCampaign,
  createCampaignSeries,
  estimateCampaignCost,
  type Campaign,
  type Contact,
  type FollowUpFilter,
  type Segment,
  type TemplateHeaderMedia,
  type WhatsappContext,
  type WhatsappTemplate,
} from "@/services/api"

/**
 * Three steps, one question each: what to send, who gets it (and how they are
 * labelled), and when. It used to be five, with the name, the parameters and
 * the labels each on a screen of their own — every extra Next is a place where
 * someone who broadcasts daily gives up.
 */
const STEPS = ["Message", "Audience & labels", "Review & send"] as const

type AudienceMode = "all" | "tag" | "segment" | "followUp"

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

/** "promo_offer · 1 Oct": what an unnamed campaign is called. */
function defaultCampaignName(templateName: string, now: Date = new Date()): string {
  if (!templateName) return ""
  return `${templateName} · ${now.getDate()} ${now.toLocaleString("en", { month: "short" })}`
}

const DIALOG_TITLE: Record<CampaignPrefill["kind"] | "new", string> = {
  new: "New campaign",
  duplicate: "Duplicate campaign",
  followUp: "Follow-up campaign",
}

export function NewCampaignDialog({
  open,
  onOpenChange,
  context,
  onCreated,
  initialSegmentId,
  starter,
  prefill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: WhatsappContext
  /** The campaign that was created; undefined for a repeating broadcast. */
  onCreated: (campaign?: Campaign) => void
  // Pre-select a segment audience ("Create campaign from this segment")
  initialSegmentId?: string
  /** Goal-shaped starting point from the campaigns page starter library. */
  starter?: CampaignStarter
  /** Opens filled in from an earlier campaign: "Duplicate" or "Follow up". */
  prefill?: CampaignPrefill
}) {
  const [step, setStep] = useState(0)

  // Step 1 — message
  const [name, setName] = useState("")
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [paramValues, setParamValues] = useState<string[]>([])
  const [headerMedia, setHeaderMedia] = useState<TemplateHeaderMedia | undefined>(undefined)
  const [sampleContact, setSampleContact] = useState<Contact | null>(null)
  const [attributeKeys, setAttributeKeys] = useState<string[]>([])
  // Parameters from a prefill, held until the template's variable count is
  // known. Applied earlier, the resize effect below would trim them to zero
  // while the template list is still loading.
  const pendingParams = useRef<string[] | null>(null)

  // Step 2 — audience and labels
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all")
  const [audienceTag, setAudienceTag] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [segments, setSegments] = useState<Segment[]>([])
  const [followUp, setFollowUp] = useState<{
    campaignId: string
    campaignName: string
    filter: FollowUpFilter
  } | null>(null)
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [knownTags, setKnownTags] = useState<string[]>([])
  // `labelsTouched` stops the suggested label from coming back after the user
  // removed it, when they step back and forward again.
  const [labels, setLabels] = useState<string[]>([])
  const [labelDraft, setLabelDraft] = useState("")
  const [labelsTouched, setLabelsTouched] = useState(false)

  // Step 3 — review and send
  const [scheduleMode, setScheduleMode] = useState<"now" | "later" | "repeat">("now")
  const [scheduledLocal, setScheduledLocal] = useState("")
  // Repeat: which days, at what time, between which dates — a week, every day,
  // by default. The browser turns this into exact send times (its own zone,
  // so 10:00 stays 10:00 across a clock change) and the server stores those.
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [repeatTime, setRepeatTime] = useState("10:00")
  const [repeatStart, setRepeatStart] = useState(() => localDateString())
  const [repeatEnd, setRepeatEnd] = useState(() => addDays(localDateString(), 6))
  const [trackLinks, setTrackLinks] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const selectedTemplate = templates.find((t) => t.name === templateName) || null
  const bodyText = selectedTemplate ? templateBody(selectedTemplate) : ""
  const variableCount = countBodyVariables(bodyText)
  // Null unless the template was approved with an image/video/document header.
  const headerFormat = selectedTemplate ? templateHeaderMediaFormat(selectedTemplate) : null
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // A repeating broadcast names each send "<name> · <day>" itself, so its
  // default name carries no date of its own.
  const effectiveName =
    name.trim() || (scheduleMode === "repeat" ? templateName : defaultCampaignName(templateName))
  const repeatRuns = useMemo(
    () =>
      buildRunTimes({ startDate: repeatStart, endDate: repeatEnd, time: repeatTime, weekdays: repeatWeekdays }),
    [repeatStart, repeatEnd, repeatTime, repeatWeekdays]
  )
  const repeatError = scheduleMode === "repeat" ? checkPlan(repeatRuns) : null
  const formatRun = (d: Date) =>
    d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
  const repeatSummary =
    repeatRuns.length > 0
      ? `${describeWeekdays(repeatWeekdays)} at ${repeatTime}, ${repeatRuns[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${repeatRuns[repeatRuns.length - 1].toLocaleDateString(undefined, { day: "numeric", month: "short" })} (${repeatRuns.length} send${repeatRuns.length === 1 ? "" : "s"})`
      : "No sends"
  // A prefilled template that is no longer approved can't be sent; say so
  // rather than showing an empty picker with no explanation.
  const templateMissing = !templatesLoading && !!templateName && !selectedTemplate

  const reset = () => {
    setStep(0)
    setName("")
    setTemplateName("")
    setParamValues([])
    pendingParams.current = null
    setHeaderMedia(undefined)
    setAudienceMode("all")
    setAudienceTag("")
    setSegmentId("")
    setFollowUp(null)
    setAudienceCount(null)
    setLabels([])
    setLabelDraft("")
    setLabelsTouched(false)
    setScheduleMode("now")
    setScheduledLocal("")
    setRepeatWeekdays([0, 1, 2, 3, 4, 5, 6])
    setRepeatTime("10:00")
    setRepeatStart(localDateString())
    setRepeatEnd(addDays(localDateString(), 6))
    setTrackLinks(false)
    setCreateError(null)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) reset()
  }

  // Fill the form from an earlier campaign. Runs once per opening.
  useEffect(() => {
    if (!open || !prefill) return
    setName(prefill.name)
    setTemplateName(prefill.templateName)
    pendingParams.current = prefill.templateParameters.length ? prefill.templateParameters : null
    setHeaderMedia(prefill.headerMedia)
    setTrackLinks(prefill.trackLinks)
    const a = prefill.audience
    setAudienceMode(a.mode)
    if (a.mode === "tag") setAudienceTag(a.tag)
    if (a.mode === "segment") setSegmentId(a.segmentId)
    if (a.mode === "followUp") {
      setFollowUp({ campaignId: a.campaignId, campaignName: a.campaignName, filter: a.filter })
    }
    if (prefill.labels) {
      setLabels(prefill.labels)
      setLabelsTouched(true)
    }
  }, [open, prefill])

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
        const loaded = Array.isArray(res) ? res : []
        setSegments(loaded)
        // A starter names the audience it wants; segments carry no record of
        // which starter built them, so it is matched by name. A miss is normal
        // — the segment may simply not exist yet — and the audience step offers
        // to build it rather than silently falling back to everyone.
        const wanted = starter ? starterSegmentName(starter) : undefined
        if (wanted) {
          const match = loaded.find((s) => s.name === wanted)
          if (match) {
            setAudienceMode("segment")
            setSegmentId(match.id)
          }
        }
      })
      // A swallowed failure here is indistinguishable from an empty list —
      // the picker just says "No segments yet".
      .catch((err) => toast.error(getErrorMessage(err) || "Failed to load segments"))
    if (starter) setName(starter.name)
    if (initialSegmentId) {
      setAudienceMode("segment")
      setSegmentId(initialSegmentId)
    }

    getContactAttributeKeys(context.accountId)
      .then((keys) => {
        if (Array.isArray(keys)) setAttributeKeys([...new Set(keys)].sort())
      })
      .catch(swallow("app/dashboard/campaigns/new-campaign-dialog.tsx"))
    // Complete tag list, server-side and ordered by usage. Picking an audience
    // tag from a 50-contact sample meant the tag you wanted was missing exactly
    // when the account was big enough for tagging to be worth doing.
    listContactTags(context.accountId)
      .then((tags) => {
        if (Array.isArray(tags)) setKnownTags(tags.map((t) => t.tag))
      })
      .catch(swallow("app/dashboard/campaigns/new-campaign-dialog.tsx"))
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
  }, [open, context.accountId, context.wabaId, initialSegmentId, starter])

  // "Create segment" opens in a new tab; pick up the new segment when the
  // user comes back to this one.
  useEffect(() => {
    if (!open) return
    const onFocus = () => {
      listSegments(context.accountId)
        .then((res) => setSegments(Array.isArray(res) ? res : []))
        .catch(swallow("app/dashboard/campaigns/new-campaign-dialog.tsx"))
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [open, context.accountId])

  // Resize parameter inputs when the template changes. Prefilled values are
  // applied here, once the template (and so its variable count) is known.
  useEffect(() => {
    if (!selectedTemplate) return
    const pending = pendingParams.current
    pendingParams.current = null
    setParamValues((prev) => {
      const source = pending ?? prev
      const next = [...source.slice(0, variableCount)]
      while (next.length < variableCount) next.push("")
      return next
    })
  }, [variableCount, selectedTemplate])

  // Audience size. Tag and "all" count opted-in contacts directly; a segment
  // shows its live memberCount ("members": it can include opted-out contacts,
  // which the send skips); a follow-up is counted by the same server query the
  // send uses, through the cost estimate, because only that query knows who
  // read or replied.
  useEffect(() => {
    if (!open || step !== 1) return
    if (audienceMode === "segment") {
      setAudienceCount(segments.find((s) => s.id === segmentId)?.memberCount ?? null)
      setAudienceLoading(false)
      return
    }
    if (audienceMode === "tag" && !audienceTag) {
      setAudienceCount(null)
      return
    }
    let live = true
    setAudienceLoading(true)
    const count =
      audienceMode === "followUp" && followUp
        ? estimateCampaignCost({
            accountId: context.accountId,
            templateName,
            followUpCampaignId: followUp.campaignId,
            followUpFilter: followUp.filter,
          }).then((res) => res.recipientCount)
        : listContacts(context.accountId, {
            optedIn: true,
            tag: audienceMode === "tag" ? audienceTag : undefined,
            limit: 1,
          }).then((res) => res.total ?? 0)
    count
      .then((n) => live && setAudienceCount(n))
      .catch(() => live && setAudienceCount(null))
      .finally(() => live && setAudienceLoading(false))
    return () => {
      live = false
    }
  }, [open, step, audienceMode, audienceTag, segmentId, segments, followUp, templateName, context.accountId])

  // Priced on the review step, once the template and audience are both settled.
  // Earlier would mean re-pricing on every keystroke of an audience the customer
  // is still choosing, and the estimate walks the same audience query the send
  // does — that is not a cheap call on a large account.
  const estimate = useCostEstimate({
    enabled: open && step === 2,
    accountId: context.accountId,
    phoneNumberId: context.phoneNumberId,
    templateName,
    ...(selectedTemplate?.language ? { templateLanguage: selectedTemplate.language } : {}),
    ...(audienceMode === "tag" && audienceTag ? { audienceTag } : {}),
    ...(audienceMode === "segment" && segmentId ? { segmentId } : {}),
    ...(audienceMode === "followUp" && followUp
      ? { followUpCampaignId: followUp.campaignId, followUpFilter: followUp.filter }
      : {}),
  })

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
      if (!templateName || templateMissing) return "Pick an approved template"
      if (paramValues.some((v) => !v.trim())) return "Fill in all template variables"
      // A media header isn't optional on a template approved with one: without
      // it every recipient fails identically at Meta, after the audience has
      // already been snapshotted.
      if (headerFormat && !headerMedia?.link && !headerMedia?.mediaId) {
        return `This template needs a header ${headerFormat}`
      }
    }
    if (step === 1) {
      if (audienceMode === "tag" && !audienceTag) return "Pick a tag"
      if (audienceMode === "segment" && !segmentId) return "Pick a segment"
      if (audienceMode !== "segment" && audienceCount === 0)
        return "No opted-in contacts match — campaign can't be created."
    }
    if (step === 2) {
      if (scheduleMode === "later") {
        if (!scheduledLocal) return "Pick a date and time"
        if (new Date(scheduledLocal).getTime() <= Date.now()) return "Scheduled time must be in the future"
      }
      if (scheduleMode === "repeat") {
        if (audienceMode === "followUp") return "A follow-up can't repeat — pick another audience or send it once"
        if (repeatError) return repeatError
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
    // Entering the audience step: offer one label per campaign run by default.
    if (step === 0 && !labelsTouched) setLabels([suggestCampaignLabel(effectiveName)])
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const changeLabels = (next: string[]) => {
    setLabels(next)
    setLabelsTouched(true)
  }

  const commitLabelDraft = () => {
    if (!labelDraft.trim()) return
    changeLabels(addLabel(labels, labelDraft))
    setLabelDraft("")
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
      if (scheduleMode === "repeat") {
        const series = await createCampaignSeries({
          accountId: context.accountId,
          wabaId: context.wabaId,
          phoneNumberId: context.phoneNumberId,
          name: effectiveName,
          templateName,
          templateLanguage: selectedTemplate?.language || "en_US",
          ...(variableCount > 0 ? { templateParameters: paramValues } : {}),
          ...(headerFormat && headerMedia ? { headerMedia } : {}),
          ...(trackLinks ? { trackLinks: true } : {}),
          ...(labels.length ? { recipientTags: labels } : {}),
          ...(audienceMode === "tag" ? { audienceTag } : {}),
          ...(audienceMode === "segment" ? { segmentId } : {}),
          timeZone: timezone,
          runAt: repeatRuns.map((d) => d.toISOString()),
        })
        toast.success(
          `Repeating broadcast set: ${series.runs.length} send${series.runs.length === 1 ? "" : "s"}, first ${formatRun(new Date(series.runs[0].runAt))}`
        )
        handleOpenChange(false)
        onCreated()
        return
      }
      const created = await createCampaign({
        accountId: context.accountId,
        wabaId: context.wabaId,
        phoneNumberId: context.phoneNumberId,
        name: effectiveName,
        templateName,
        templateLanguage: selectedTemplate?.language || "en_US",
        ...(variableCount > 0 ? { templateParameters: paramValues } : {}),
        ...(headerFormat && headerMedia ? { headerMedia } : {}),
        ...(trackLinks ? { trackLinks: true } : {}),
        ...(labels.length ? { recipientTags: labels } : {}),
        // At most one audience selector; none means every opted-in contact.
        ...(audienceMode === "tag" ? { audienceTag } : {}),
        ...(audienceMode === "segment" ? { segmentId } : {}),
        ...(audienceMode === "followUp" && followUp
          ? { followUpCampaignId: followUp.campaignId, followUpFilter: followUp.filter }
          : {}),
        ...(scheduleMode === "later" ? { scheduledAt: new Date(scheduledLocal).toISOString() } : {}),
      })
      toast.success(scheduleMode === "later" ? "Campaign scheduled" : "Campaign started")
      handleOpenChange(false)
      onCreated(created)
    } catch (e) {
      // 400s (empty audience, past schedule) stay inline on the review step
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
  const followUpLabel = followUp
    ? `${FOLLOW_UP_FILTER_LABELS[followUp.filter]} to ${followUp.campaignName || "an earlier campaign"}`
    : ""
  const audienceLabel =
    audienceMode === "tag"
      ? `Tag: ${audienceTag}`
      : audienceMode === "segment"
        ? `Segment: ${selectedSegment?.name || segmentId}`
        : audienceMode === "followUp"
          ? followUpLabel
          : "All opted-in contacts"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_TITLE[prefill?.kind ?? "new"]}</DialogTitle>
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
              {templateMissing ? (
                <p className="text-xs text-destructive">
                  &quot;{templateName}&quot; isn&apos;t an approved template any more. Pick another one.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only approved templates can be sent as broadcasts.
                </p>
              )}
              {/* A starter can't choose the template — it has to be one Meta
                  approved for this account — so it says what to look for. */}
              {starter && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">For this goal:</span>{" "}
                  {starter.templateHint}
                </p>
              )}
              {prefill?.kind === "followUp" && (
                <p className="text-xs text-muted-foreground">
                  A follow-up usually says something new: a reminder, a deadline, or a different offer.
                </p>
              )}
            </div>

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

            {variableCount > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Fill in the template&apos;s {"{{1}}"}–{"{{"}
                  {variableCount}
                  {"}}"}. Type text, or insert a token that&apos;s filled in for each contact.
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
              </div>
            )}

            {selectedTemplate && (
              <div className="rounded-md border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Preview — {selectedTemplate.language}
                  {variableCount > 0 &&
                    (sampleContact
                      ? `, as ${sampleContact.name || sampleContact.waId} would see it`
                      : ", no opted-in contact to sample")}
                </p>
                <p className="text-sm whitespace-pre-wrap">{previewText || "(no body text)"}</p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="campaign-name">
                Campaign name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={defaultCampaignName(templateName) || "Named after the template and today's date"}
              />
              <p className="text-xs text-muted-foreground">Only you see this. It isn&apos;t sent.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <RadioGroup value={audienceMode} onValueChange={(v) => setAudienceMode(v as AudienceMode)}>
              {followUp && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary-soft/40 p-3">
                  <RadioGroupItem value="followUp" id="audience-follow-up" />
                  <Label htmlFor="audience-follow-up" className="cursor-pointer">
                    <Reply className="mr-1 inline h-3.5 w-3.5" />
                    People from {followUp.campaignName ? `“${followUp.campaignName}”` : "the earlier campaign"} who
                  </Label>
                  <div className="min-w-40 flex-1">
                    <Select
                      value={followUp.filter}
                      onValueChange={(v) => {
                        setFollowUp({ ...followUp, filter: v as FollowUpFilter })
                        setAudienceMode("followUp")
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_FILTER_ORDER.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FOLLOW_UP_FILTER_LABELS[f].toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
                        {/* A duplicated campaign's tag may no longer be on anyone. */}
                        {audienceTag && !knownTags.includes(audienceTag) && (
                          <SelectItem value={audienceTag}>{audienceTag}</SelectItem>
                        )}
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
                  {segments.length ? (
                    <Select
                      value={segmentId}
                      onValueChange={(v) => {
                        setSegmentId(v)
                        setAudienceMode("segment")
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.memberCount ?? "?"} members)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    // New tab so the wizard's progress survives; the focus
                    // listener above refetches segments on return.
                    <div className="flex h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span>No segments yet</span>
                      <Button asChild variant="link" size="sm" className="h-8 px-0">
                        <a href="/dashboard/segments/new" target="_blank" rel="noopener noreferrer">
                          <Plus className="h-3.5 w-3.5" /> Create segment
                        </a>
                      </Button>
                    </div>
                  )}
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting the audience...
                </span>
              ) : audienceCount == null ? (
                <span className="text-sm text-muted-foreground">
                  {audienceMode === "tag" ? "Pick a tag to see how many it reaches." : "Audience size unknown."}
                </span>
              ) : audienceCount === 0 ? (
                audienceMode === "followUp" ? (
                  <span className="text-sm font-medium text-destructive">
                    Nobody from that campaign matches — or they have opted out since. Pick another group.
                  </span>
                ) : (
                  // This is where a new account stops dead: the list is full, the
                  // template is approved, and nothing can be sent. Saying "can't
                  // be created" without saying what to do leaves the one fixable
                  // problem in the product looking like a broken screen. Both
                  // links open in a new tab so the wizard keeps its progress.
                  <span className="text-sm">
                    <span className="font-medium text-destructive">
                      No opted-in contacts match — campaign can&apos;t be created.
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      Only contacts who opted in can be messaged.{" "}
                      <a
                        href="/dashboard/contacts?opted=out"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Record consent you already hold
                      </a>
                      , or{" "}
                      <a
                        href="/dashboard/links"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        share an opt-in link
                      </a>{" "}
                      to collect it.
                    </span>
                  </span>
                )
              ) : (
                <span className="text-sm">
                  <span className="font-semibold">{audienceCount}</span> opted-in contact
                  {audienceCount === 1 ? "" : "s"} will get this campaign
                </span>
              )}
            </div>
            {/* The starter wanted a named segment and the account doesn't have
                it yet. Offering to build it beats silently sending to everyone
                under a campaign named "Win-back". New tab, so the wizard keeps
                its progress; the focus listener above reloads segments. */}
            {starter &&
              starterSegmentName(starter) &&
              !segments.some((s) => s.name === starterSegmentName(starter)) && (
                <p className="text-xs text-muted-foreground">
                  This goal usually sends to{" "}
                  <span className="font-medium text-foreground">{starterSegmentName(starter)}</span>
                  , which doesn&apos;t exist yet.{" "}
                  <a
                    href={`/dashboard/segments/new?starter=${encodeURIComponent(starter.segmentStarterId ?? "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Build it
                  </a>{" "}
                  and it appears here.
                </p>
              )}

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Label everyone this campaign reaches</p>
                <p className="text-xs text-muted-foreground">
                  Each contact gets these labels once their message is sent, so tomorrow you can see who
                  got it and whom to follow up. Skipped and failed contacts aren&apos;t labelled. Labels
                  are contact tags, and adding them doesn&apos;t start drips or automations.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => changeLabels(labels.filter((l) => l !== label))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove label ${label}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {labels.length === 0 && (
                  <span className="text-sm text-muted-foreground">No labels. Contacts won&apos;t be tagged.</span>
                )}
              </div>
              {!labelsTouched && labels.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Suggested from the campaign name and today&apos;s date. Remove it or add your own.
                </p>
              )}

              <div className="flex gap-2">
                <Input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      commitLabelDraft()
                    }
                  }}
                  placeholder="New label, e.g. follow-up"
                  maxLength={100}
                  disabled={labels.length >= MAX_CAMPAIGN_LABELS}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={commitLabelDraft}
                  disabled={!labelDraft.trim() || labels.length >= MAX_CAMPAIGN_LABELS}
                >
                  <Plus className="mr-1 h-4 w-4" /> Create label
                </Button>
              </div>
              {labels.length >= MAX_CAMPAIGN_LABELS && (
                <p className="text-xs text-muted-foreground">Up to {MAX_CAMPAIGN_LABELS} labels per campaign.</p>
              )}

              {labels.length < MAX_CAMPAIGN_LABELS && knownTags.some((t) => !labels.includes(t)) && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Or reuse an existing tag</p>
                  <div className="flex flex-wrap gap-1.5">
                    {knownTags
                      .filter((t) => !labels.includes(t))
                      .slice(0, 12)
                      .map((tag) => (
                        <Button
                          key={tag}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => changeLabels(addLabel(labels, tag))}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {tag}
                        </Button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <RadioGroup
              value={scheduleMode}
              onValueChange={(v) => setScheduleMode(v as "now" | "later" | "repeat")}
            >
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
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="repeat" id="schedule-repeat" disabled={audienceMode === "followUp"} />
                <Label htmlFor="schedule-repeat" className="flex-1 cursor-pointer">
                  Repeat
                  <span className="block text-xs font-normal text-muted-foreground">
                    {audienceMode === "followUp"
                      ? "Not for a follow-up: it would message the same people every day."
                      : "Send on a schedule — every day this week, weekdays at 10:00, and so on."}
                  </span>
                </Label>
              </div>
            </RadioGroup>
            {scheduleMode === "later" && (
              <p className="text-xs text-muted-foreground">
                Times are in your timezone ({timezone}); sent to the server as UTC.
              </p>
            )}

            {scheduleMode === "repeat" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">On these days</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((label, day) => {
                      const on = repeatWeekdays.includes(day)
                      return (
                        <Button
                          key={label}
                          type="button"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          className="h-8 w-12 px-0"
                          aria-pressed={on}
                          onClick={() =>
                            setRepeatWeekdays((prev) =>
                              on ? prev.filter((d) => d !== day) : [...prev, day].sort()
                            )
                          }
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="repeat-time" className="text-xs text-muted-foreground">
                      At
                    </Label>
                    <Input
                      id="repeat-time"
                      type="time"
                      value={repeatTime}
                      onChange={(e) => setRepeatTime(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="repeat-start" className="text-xs text-muted-foreground">
                      From
                    </Label>
                    <Input
                      id="repeat-start"
                      type="date"
                      value={repeatStart}
                      min={localDateString()}
                      onChange={(e) => {
                        setRepeatStart(e.target.value)
                        if (e.target.value > repeatEnd) setRepeatEnd(e.target.value)
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="repeat-end" className="text-xs text-muted-foreground">
                      Until
                    </Label>
                    <Input
                      id="repeat-end"
                      type="date"
                      value={repeatEnd}
                      min={repeatStart}
                      onChange={(e) => setRepeatEnd(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                {repeatError ? (
                  <p className="text-xs text-destructive">{repeatError}</p>
                ) : (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{repeatSummary}</span> — first{" "}
                      {formatRun(repeatRuns[0])}, last {formatRun(repeatRuns[repeatRuns.length - 1])} (
                      {timezone}).
                    </p>
                    <p>
                      Each send picks its audience at its own time, so people who opt in or get tagged
                      during the week are included. Labels ending in a date move to each send&apos;s day. Up
                      to {MAX_SERIES_RUNS} sends.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Track link clicks</p>
                <p className="text-xs text-muted-foreground">
                  Replaces any web address in your variables with a short tracking link, so you can see
                  who clicked. It changes the address recipients see, which is why it&apos;s off unless
                  you ask for it.
                </p>
              </div>
              <Switch checked={trackLinks} onCheckedChange={setTrackLinks} />
            </div>

            {scheduleMode === "repeat" && !repeatError && (
              <p className="text-xs text-muted-foreground">
                The estimate below is for one send to today&apos;s audience. Each send is priced when it
                goes out.
              </p>
            )}
            <CostEstimate {...estimate} />

            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm font-medium">Summary</p>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Campaign</dt>
                  <dd className="text-right font-medium">{effectiveName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Template</dt>
                  <dd className="text-right">
                    {templateName} ({selectedTemplate?.language})
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Audience</dt>
                  <dd className="text-right">
                    {audienceLabel}
                    {audienceCount != null && audienceMode !== "segment"
                      ? ` — ${audienceCount} contact${audienceCount === 1 ? "" : "s"}`
                      : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Labels</dt>
                  <dd className="text-right">{labels.length ? labels.join(", ") : "None"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Link tracking</dt>
                  <dd>{trackLinks ? "On" : "Off"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Schedule</dt>
                  <dd className="text-right">
                    {scheduleMode === "now"
                      ? "Send immediately"
                      : scheduleMode === "repeat"
                        ? repeatSummary
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
              {scheduleMode === "later"
                ? "Schedule campaign"
                : scheduleMode === "repeat"
                  ? "Start repeating"
                  : "Send campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
