"use client"

import { useEffect, useRef, useState } from "react"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { Sparkles, Loader2, ChevronDown, RotateCcw } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import {
  ApiError,
  generateWhatsappTemplates,
  type GeneratedTemplate,
} from "@/services/api"

type Stage = "form" | "generating" | "results" | "error"

const TONES: { key: GeneratedTemplate["tone"]; label: string }[] = [
  { key: "professional", label: "Professional" },
  { key: "casual", label: "Casual" },
  { key: "promotional", label: "Promotional" },
]

// Second stage swaps in well before typical total latency (15-90s) so the
// user isn't stuck reading "Drafting..." for the whole request.
const COMPLIANCE_STAGE_DELAY_MS = 8000

function highlightTokens(text: string) {
  const parts = text.split(/(\{\{\s*[^}]+?\s*\}\})/g)
  return parts.map((part, i) =>
    /^\{\{\s*[^}]+?\s*\}\}$/.test(part) ? (
      <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function ComplianceBadge({ compliance }: { compliance: GeneratedTemplate["compliance"] }) {
  const { riskLevel, notes } = compliance
  const badgeClass =
    riskLevel === "low"
      ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-green-300"
      : riskLevel === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-red-300"
  const label =
    riskLevel === "low" ? "Ready to submit" : riskLevel === "medium" ? "We adjusted this" : "Review carefully"

  if (!notes || notes.length === 0) {
    return (
      <Badge variant="outline" className={badgeClass}>
        {label}
      </Badge>
    )
  }

  return (
    <Collapsible className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={badgeClass}>
          {label}
        </Badge>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-muted-foreground">
            details <ChevronDown className="ml-0.5 h-3 w-3" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
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
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{template.name}</span>
          <ComplianceBadge compliance={template.compliance} />
        </div>

        <p className="text-sm whitespace-pre-wrap break-words">{highlightTokens(template.body)}</p>

        {template.variables.length > 0 && (
          <div className="space-y-1.5">
            {template.variables.map((v) => (
              <div key={v.position} className="flex items-center gap-2">
                <Label className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={v.name}>
                  {`{{${v.position}}} ${v.name}`}
                </Label>
                <Input
                  className="h-7 text-xs"
                  value={examples[v.position] ?? v.example}
                  onChange={(e) => onExampleChange(v.position, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <Button size="sm" className="w-full" onClick={onUse}>
          Use this template
        </Button>
      </CardContent>
    </Card>
  )
}

// Patches only the example values shown to the user back into a cloned components[]
// array — position/name/order come straight from the backend and are never touched.
function patchComponentExamples(components: any[], examples: Record<number, string>): any[] {
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
        const params = component.example.body_text_named_params.map((p: any, i: number) => ({
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
      const response: any = await generateWhatsappTemplates({ accountId, wabaId, prompt, provider })
      const payload = response?.data ?? response
      setTemplates(Array.isArray(payload?.templates) ? payload.templates : [])
      setExampleEdits({})
      setStage("results")
    } catch (err) {
      const status = err instanceof ApiError ? getErrorStatus(err) : undefined
      if (status === 429) {
        setErrorMessage("AI is rate-limited, try again in a moment")
      } else if (status === 502) {
        setErrorMessage(getErrorMessage(err) || "AI service is temporarily unavailable")
      } else {
        setErrorMessage(getErrorMessage(err) || "Failed to generate templates")
      }
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

      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
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
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {TONES.map((t) => (
              <TabsContent key={t.key} value={t.key} className="grid gap-3 pt-4 sm:grid-cols-2">
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
