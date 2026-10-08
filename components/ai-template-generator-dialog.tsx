"use client"

import { useEffect, useRef, useState } from "react"
import { aiGenerateErrorMessage } from "@/lib/ai-generate-error"
import { Sparkles, Loader2, ChevronDown, RotateCcw, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  generateWhatsappTemplates,
  type GeneratedTemplate,
} from "@/services/api"
import type { TemplateComponent } from "@/lib/whatsapp-template"

type Stage = "form" | "generating" | "results" | "error"

const TONES: { key: GeneratedTemplate["tone"]; label: string }[] = [
  { key: "professional", label: "Professional" },
  { key: "casual", label: "Casual" },
  { key: "promotional", label: "Promotional" },
]

// Second stage swaps in well before typical total latency (15-90s) so the
// user isn't stuck reading "Drafting..." for the whole request.
const COMPLIANCE_STAGE_DELAY_MS = 8000

/** `appointment_confirmation_prof` → `Appointment confirmation`. */
function humanize(name: string) {
  const words = name
    .replace(/_(prof|professional|cas|casual|promo|promotional)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The body as the customer will read it: each `{{n}}` replaced by its current
 * sample value, tinted so it's clear which words are variables.
 */
function renderPreview(body: string, template: GeneratedTemplate, examples: Record<number, string>) {
  const parts = body.split(/(\{\{\s*[^}]+?\s*\}\})/g)
  return parts.map((part, i) => {
    const token = part.match(/^\{\{\s*([^}]+?)\s*\}\}$/)?.[1]
    if (!token) return <span key={i}>{part}</span>
    const variable = template.variables.find((v) => String(v.position) === token || v.name === token)
    const value = variable ? (examples[variable.position] ?? variable.example) : ""
    return (
      <span
        key={i}
        className="rounded-[4px] bg-primary-soft px-1 py-px font-medium text-primary-emphasis"
        title={`{{${token}}}`}
      >
        {value || `{{${token}}}`}
      </span>
    )
  })
}

// Meta makes the final call on every template, so the labels predict rather
// than promise. "High" covers scenarios Meta restricts outright — rewording
// can't rescue those, and the label says so.
const RISK = {
  low: { label: "Likely to be approved", pill: "bg-success-soft text-success", dot: "bg-success" },
  medium: { label: "Check the policy notes", pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  high: { label: "Likely to be rejected", pill: "bg-destructive-soft text-destructive", dot: "bg-destructive" },
} as const

function CompliancePill({ riskLevel }: { riskLevel: GeneratedTemplate["compliance"]["riskLevel"] }) {
  const risk = RISK[riskLevel] ?? RISK.high
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${risk.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
      {risk.label}
    </span>
  )
}

function ComplianceNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null
  return (
    <Collapsible>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        {notes.length === 1 ? "1 policy note" : `${notes.length} policy notes`}
        <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function GeneratedTemplateCard({
  template,
  examples,
  onExampleChange,
  onUse,
}: {
  template: GeneratedTemplate
  examples: Record<number, string>
  onExampleChange: (position: number, value: string) => void
  onUse: () => void
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{humanize(template.name)}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground" title={template.name}>
            {template.name}
          </p>
        </div>
        <CompliancePill riskLevel={template.compliance.riskLevel} />
      </div>

      {/* Message preview, styled like the incoming bubble the customer sees. */}
      <div className="mt-3 rounded-lg bg-muted/60 p-3">
        <div className="rounded-lg rounded-tl-sm bg-background px-3 py-2.5 text-sm leading-relaxed shadow-xs">
          <p className="whitespace-pre-wrap break-words">{renderPreview(template.body, template, examples)}</p>
        </div>
      </div>

      {template.variables.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sample values</p>
          {template.variables.map((v) => {
            const id = `${template.name}-var-${v.position}`
            return (
              <div key={v.position} className="space-y-1">
                <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-foreground-secondary">
                  <span className="font-mono text-[10px] text-muted-foreground">{`{{${v.position}}}`}</span>
                  {humanize(v.name)}
                </Label>
                <Input
                  id={id}
                  className="h-8 md:text-xs"
                  value={examples[v.position] ?? v.example}
                  onChange={(e) => onExampleChange(v.position, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-auto space-y-3 pt-4">
        <ComplianceNotes notes={template.compliance.notes ?? []} />
        <Button variant="soft" size="sm" className="w-full" onClick={onUse}>
          Use this template <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

// Patches only the example values shown to the user back into a cloned components[]
// array — position/name/order come straight from the backend and are never touched.
function patchComponentExamples(components: TemplateComponent[], examples: Record<number, string>): TemplateComponent[] {
  if (Object.keys(examples).length === 0) return components

  return components.map((component) => {
    if (component.type === "HEADER" && component.example?.header_text) {
      const value = examples[1]
      if (value === undefined) return component
      return { ...component, example: { header_text: [value] } }
    }

    if (component.type === "BODY" && component.example) {
      if (component.example.body_text) {
        const row: string[] = component.example.body_text[0] || []
        const patchedRow = row.map((original: string, i: number) => examples[i + 1] ?? original)
        return { ...component, example: { body_text: [patchedRow] } }
      }
      if (component.example.body_text_named_params) {
        const params = component.example.body_text_named_params.map((p, i: number) => ({
          ...p,
          example: examples[i + 1] ?? p.example,
        }))
        return { ...component, example: { body_text_named_params: params } }
      }
    }

    return component
  })
}

export function AITemplateGeneratorDialog({
  accountId,
  wabaId,
  onUseTemplate,
}: {
  accountId: string
  wabaId: string
  onUseTemplate: (template: GeneratedTemplate) => void
}) {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>("form")
  const [prompt, setPrompt] = useState("")
  const [provider, setProvider] = useState<"anthropic" | "gemini">("gemini")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [complianceStage, setComplianceStage] = useState(false)
  const [templates, setTemplates] = useState<GeneratedTemplate[]>([])
  const [errorMessage, setErrorMessage] = useState("")
  const [exampleEdits, setExampleEdits] = useState<Record<string, Record<number, string>>>({})
  const complianceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (complianceTimer.current) clearTimeout(complianceTimer.current)
    }
  }, [])

  const resetToForm = () => {
    setStage("form")
    setErrorMessage("")
  }

  const runGenerate = async () => {
    if (complianceTimer.current) clearTimeout(complianceTimer.current)
    setStage("generating")
    setComplianceStage(false)
    complianceTimer.current = setTimeout(() => setComplianceStage(true), COMPLIANCE_STAGE_DELAY_MS)

    try {
      const response = await generateWhatsappTemplates({ accountId, wabaId, prompt, provider })
      setTemplates(Array.isArray(response?.templates) ? response.templates : [])
      setExampleEdits({})
      setStage("results")
    } catch (err) {
      setErrorMessage(aiGenerateErrorMessage(err))
      setStage("error")
    } finally {
      if (complianceTimer.current) clearTimeout(complianceTimer.current)
    }
  }

  const handleSubmit = () => {
    if (!prompt.trim()) {
      setErrorMessage("Describe what you want to tell your customers first")
      setStage("error")
      return
    }
    runGenerate()
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setStage("form")
      setPrompt("")
      setAdvancedOpen(false)
      setTemplates([])
      setExampleEdits({})
      setErrorMessage("")
    }
  }

  const handleUse = (template: GeneratedTemplate) => {
    const examples = exampleEdits[template.name] || {}
    const patched: GeneratedTemplate = { ...template, components: patchComponentExamples(template.components, examples) }
    onUseTemplate(patched)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
      </Button>

      <DialogContent className={stage === "results" ? "max-h-[88vh] max-w-4xl" : "max-h-[85vh] max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>Generate templates with AI</DialogTitle>
          <DialogDescription>
            Describe what you want to tell your customers — we'll draft templates and check them against
            WhatsApp's policy before you submit.
          </DialogDescription>
        </DialogHeader>

        {stage === "form" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-template-prompt">What do you want to tell your customers?</Label>
              <Textarea
                id="ai-template-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. remind customers about a pending payment"
                rows={4}
              />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  Advanced <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="ai-template-provider">Model</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as "anthropic" | "gemini")}>
                    <SelectTrigger id="ai-template-provider" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button onClick={handleSubmit} className="w-full">
              Generate
            </Button>
          </div>
        )}

        {stage === "generating" && (
          <div className="space-y-4 py-6 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {complianceStage ? "Checking WhatsApp policy compliance…" : "Drafting your templates…"}
            </p>
            <Progress value={complianceStage ? 75 : 35} className="mx-auto max-w-sm" />
            <p className="text-xs text-muted-foreground">This can take up to a minute or so.</p>
          </div>
        )}

        {stage === "error" && (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={resetToForm}>
                Back
              </Button>
              <Button onClick={runGenerate} disabled={!prompt.trim()}>
                <RotateCcw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          </div>
        )}

        {stage === "results" && (
          <Tabs defaultValue="professional">
            <TabsList className="grid w-full grid-cols-3">
              {TONES.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.label}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {templates.filter((template) => template.tone === t.key).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {TONES.map((t) => (
              <TabsContent key={t.key} value={t.key} className="grid gap-4 pt-4 md:grid-cols-2">
                {templates.every((template) => template.tone !== t.key) && (
                  <p className="py-10 text-center text-sm text-muted-foreground md:col-span-2">
                    No {t.label.toLowerCase()} templates this time.
                  </p>
                )}
                {templates
                  .filter((template) => template.tone === t.key)
                  .map((template) => (
                    <GeneratedTemplateCard
                      key={template.name}
                      template={template}
                      examples={exampleEdits[template.name] || {}}
                      onExampleChange={(position, value) =>
                        setExampleEdits((prev) => ({
                          ...prev,
                          [template.name]: { ...prev[template.name], [position]: value },
                        }))
                      }
                      onUse={() => handleUse(template)}
                    />
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
