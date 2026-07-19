"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, ArrowDown, ArrowUp, Clock, Loader2, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "react-hot-toast"
import {
  createDrip,
  updateDrip,
  listWhatsappTemplates,
  listContacts,
  getContactAttributeKeys,
  type Contact,
  type DripSequence,
  type DripStep,
  type WhatsappContext,
} from "@/services/api"
import {
  TemplateParamsInput,
  countTemplateVariables,
  templateBodyText,
} from "@/components/whatsapp/template-params-input"
import {
  MAX_DELAY_HOURS,
  MAX_STEPS,
  cumulativeHours,
  dayLabel,
  emptyStep,
  formatDelay,
  parseDripErrorStepIndex,
} from "@/lib/drip-utils"

type DelayUnit = "hours" | "days"

function initialUnit(delayHours: number): DelayUnit {
  return delayHours >= 24 && delayHours % 24 === 0 ? "days" : "hours"
}

export function DripBuilder({ context, drip }: { context: WhatsappContext; drip?: DripSequence | null }) {
  const router = useRouter()
  const isEdit = !!drip

  const [name, setName] = useState(drip?.name || "")
  const [description, setDescription] = useState(drip?.description || "")
  const [isActive, setIsActive] = useState(drip?.isActive ?? true)
  const [triggerType, setTriggerType] = useState<"manual" | "tag">(drip?.triggerType || "manual")
  const [triggerTag, setTriggerTag] = useState(drip?.triggerTag || "")
  const [steps, setSteps] = useState<DripStep[]>(drip?.steps?.length ? drip.steps : [emptyStep(0)])
  const [units, setUnits] = useState<DelayUnit[]>(
    (drip?.steps?.length ? drip.steps : [emptyStep(0)]).map((s) => initialUnit(s.delayHours))
  )

  const [templates, setTemplates] = useState<any[]>([])
  const [attributeKeys, setAttributeKeys] = useState<string[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState<{ index: number | null; message: string } | null>(null)

  useEffect(() => {
    listWhatsappTemplates(context.accountId, context.wabaId)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data
        setTemplates(Array.isArray(list) ? list.filter((t: any) => t.status === "APPROVED") : [])
      })
      .catch((err: any) => toast.error(err?.message || "Failed to load templates"))

    getContactAttributeKeys(context.accountId)
      .then((keys) => {
        if (Array.isArray(keys)) setAttributeKeys([...new Set(keys)].sort())
      })
      .catch(() => {})
    listContacts(context.accountId, { limit: 100 })
      .then((res) => {
        const items: Contact[] = Array.isArray(res.items) ? res.items : []
        const keys = new Set<string>()
        const tags = new Set<string>()
        for (const c of items) {
          Object.keys(c.attributes || {}).forEach((k) => keys.add(k))
          ;(c.tags || []).forEach((t) => tags.add(t))
        }
        // Merge sample-derived keys as a fallback if the endpoint is unavailable.
        setAttributeKeys((prev) => [...new Set([...prev, ...keys])].sort())
        setKnownTags([...tags].sort())
      })
      .catch(() => {})
  }, [context.accountId, context.wabaId])

  const templateByName = useMemo(() => new Map(templates.map((t: any) => [t.name, t])), [templates])

  const patchStep = (index: number, patch: Partial<DripStep>) => {
    setServerError(null)
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const setDelay = (index: number, rawValue: string, unit: DelayUnit) => {
    const n = Math.max(0, Math.floor(Number(rawValue) || 0))
    const hours = unit === "days" ? n * 24 : n
    patchStep(index, { delayHours: Math.min(hours, MAX_DELAY_HOURS) })
  }

  const setUnit = (index: number, unit: DelayUnit) => {
    setUnits((prev) => prev.map((u, i) => (i === index ? unit : u)))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    setServerError(null)
    setSteps((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setUnits((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return
    setSteps((prev) => [...prev, emptyStep(24)])
    setUnits((prev) => [...prev, "days"])
  }

  const removeStep = (index: number) => {
    setServerError(null)
    setSteps((prev) => prev.filter((_, i) => i !== index))
    setUnits((prev) => prev.filter((_, i) => i !== index))
  }

  const stepError = (index: number): string | null => {
    if (serverError?.index === index) return serverError.message
    const step = steps[index]
    if (!step.templateName) return "Pick a template"
    if (step.delayHours < 0 || step.delayHours > MAX_DELAY_HOURS) return "Delay must be 0–2160 hours (90 days)"
    const tpl = templateByName.get(step.templateName)
    const varCount = tpl ? countTemplateVariables(tpl) : 0
    if (varCount > 0) {
      const params = step.templateParameters || []
      if (params.length < varCount || params.slice(0, varCount).some((p) => !p?.trim()))
        return "Fill in all template variables"
    }
    return null
  }

  const errors = steps.map((_, i) => stepError(i))
  const flowIssues: string[] = []
  if (!name.trim()) flowIssues.push("Sequence name is required")
  if (triggerType === "tag" && !triggerTag.trim()) flowIssues.push("Pick a trigger tag")
  if (steps.length < 1) flowIssues.push("Add at least one step")
  const canSave = flowIssues.length === 0 && errors.every((e) => !e)

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    setServerError(null)
    try {
      // Only send templateParameters when the template actually has variables
      const cleanedSteps: DripStep[] = steps.map((s) => {
        const tpl = templateByName.get(s.templateName)
        const varCount = tpl ? countTemplateVariables(tpl) : 0
        const language = s.templateLanguage || tpl?.language || "en_US"
        return {
          delayHours: s.delayHours,
          templateName: s.templateName,
          templateLanguage: language,
          ...(varCount > 0 ? { templateParameters: (s.templateParameters || []).slice(0, varCount) } : {}),
        }
      })
      const payload = {
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        wabaId: context.wabaId,
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        ...(triggerType === "tag" ? { triggerTag: triggerTag.trim().toLowerCase() } : {}),
        isActive,
        steps: cleanedSteps,
      }
      if (isEdit && drip) {
        await updateDrip(drip.id, payload)
        toast.success("Sequence updated")
      } else {
        await createDrip(payload)
        toast.success("Sequence created")
      }
      router.push("/dashboard/drips")
    } catch (err: any) {
      const message = err?.message || "Failed to save sequence"
      const index = parseDripErrorStepIndex(message)
      if (index != null) setServerError({ index, message })
      else toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/drips")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to sequences
        </Button>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">{isEdit ? "Edit Sequence" : "New Sequence"}</h2>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Sequence"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="drip-name">Name</Label>
            <Input id="drip-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome series" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drip-desc">Description (optional)</Label>
            <Input id="drip-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Phone number</Label>
            <Input value={context.displayPhoneNumber || context.phoneNumberId} disabled />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
          <CardDescription>How contacts get enrolled into this sequence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup value={triggerType} onValueChange={(v) => setTriggerType(v as "manual" | "tag")}>
            <div className="flex items-center gap-2 rounded-md border p-3">
              <RadioGroupItem value="manual" id="trigger-manual" />
              <Label htmlFor="trigger-manual" className="flex-1 cursor-pointer">
                Enroll manually
                <span className="block text-xs font-normal text-muted-foreground">
                  You add contacts yourself from the sequence or a contact list.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <RadioGroupItem value="tag" id="trigger-tag" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="trigger-tag" className="cursor-pointer">
                  When a tag is added
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Opted-in contacts are auto-enrolled the moment this tag is added to them.
                </p>
                {triggerType === "tag" &&
                  (knownTags.length > 0 ? (
                    <Select value={triggerTag} onValueChange={setTriggerTag}>
                      <SelectTrigger className="h-8 w-56">
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
                      value={triggerTag}
                      onChange={(e) => setTriggerTag(e.target.value.trim().toLowerCase())}
                      placeholder="tag name"
                      className="h-8 w-56"
                    />
                  ))}
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Steps</CardTitle>
              <CardDescription>Messages are sent in order, each after its delay.</CardDescription>
            </div>
            <Badge variant="outline">
              {steps.length}/{MAX_STEPS} steps
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, i) => {
            const cum = cumulativeHours(steps, i)
            const tpl = templateByName.get(step.templateName)
            const err = errors[i]
            const unit = units[i] || "hours"
            const displayDelay = unit === "days" ? Math.round(step.delayHours / 24) : step.delayHours
            return (
              <div key={i} className="flex gap-3">
                {/* Timeline rail */}
                <div className="flex flex-col items-center pt-3 w-16 shrink-0">
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {dayLabel(cum)}
                  </Badge>
                  {i < steps.length - 1 && <div className="flex-1 w-px bg-border mt-1" />}
                </div>

                <Card className={`flex-1 ${err ? "border-destructive/50" : ""}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Step {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={i === steps.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={steps.length === 1}
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeStep(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Delay */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {i === 0 ? "After enrollment, wait" : "After previous step, wait"}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={displayDelay}
                        onChange={(e) => setDelay(i, e.target.value, unit)}
                        className="h-8 w-20"
                      />
                      <Select
                        value={unit}
                        onValueChange={(v) => {
                          const nextUnit = v as DelayUnit
                          setUnit(i, nextUnit)
                          // keep the same absolute delay, just re-express it
                          setDelay(i, String(nextUnit === "days" ? step.delayHours / 24 : step.delayHours), nextUnit)
                        }}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">hours</SelectItem>
                          <SelectItem value="days">days</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        ({formatDelay(step.delayHours)})
                      </span>
                    </div>

                    {/* Template */}
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Template</Label>
                      <Select
                        value={step.templateName}
                        onValueChange={(nameVal) => {
                          const t = templateByName.get(nameVal)
                          patchStep(i, {
                            templateName: nameVal,
                            templateLanguage: t?.language || "en_US",
                            templateParameters: [],
                          })
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={templates.length ? "Select a template" : "No approved templates"} />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t: any) => (
                            <SelectItem key={t.name} value={t.name}>
                              {t.name} ({t.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {tpl && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap rounded bg-muted/50 p-2">
                          {templateBodyText(tpl) || "(no body text)"}
                        </p>
                      )}
                    </div>

                    {/* Parameters */}
                    {tpl && countTemplateVariables(tpl) > 0 && (
                      <TemplateParamsInput
                        template={tpl}
                        values={step.templateParameters || []}
                        onChange={(vals) => patchStep(i, { templateParameters: vals })}
                        attributeKeys={attributeKeys}
                        idPrefix={`step-${i}-param`}
                      />
                    )}

                    {err && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {err}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          })}

          <Button variant="outline" size="sm" disabled={steps.length >= MAX_STEPS} onClick={addStep}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add step
          </Button>

          {flowIssues.length > 0 && (
            <ul className="space-y-1 pt-2">
              {flowIssues.map((issue, i) => (
                <li key={i} className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {issue}
                </li>
              ))}
            </ul>
          )}
          {serverError && serverError.index == null && (
            <p className="text-sm text-destructive">{serverError.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
