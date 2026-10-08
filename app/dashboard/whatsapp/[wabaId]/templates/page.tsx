"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useRouter, useSearchParams } from "next/navigation"
import { safeReturnTo } from "@/lib/return-to"
import {
  Plus,
  Loader2,
  X,
  MessageCircle,
  ExternalLink,
  PhoneCall,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createWhatsappTemplate,
  updateWhatsappTemplate,
  deleteWhatsappTemplate,
  type GeneratedTemplate,
  type WhatsappTemplate,
} from "@/services/api"
import type { TemplateComponent, TemplateButton } from "@/lib/whatsapp-template"
import { AITemplateGeneratorDialog } from "@/components/ai-template-generator-dialog"
import { Explain } from "@/components/explain"
import { useWhatsappTemplates } from "@/hooks/use-queries"
import { TemplateCard } from "@/components/templates/template-card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { FileText } from "lucide-react"
import { toast } from "react-hot-toast"
import React from "react"

type ButtonDraft = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
  text: string
  url?: string
  urlExample?: string
  phoneNumber?: string
}

// Finds {{1}} / {{name}} style placeholders, deduped in first-seen order
function extractTokens(text: string): string[] {
  const matches = [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1])
  return [...new Set(matches)]
}

function isPositional(tokens: string[]): boolean {
  return tokens.every((t) => /^\d+$/.test(t))
}

const EDITABLE_STATUSES = new Set(["APPROVED", "REJECTED"])

const TEMPLATE_PRESETS = [
  {
    label: "Order Confirmation",
    category: "UTILITY" as const,
    body: "Hi {{1}}, your order #{{2}} is confirmed and will arrive by {{3}}.",
    examples: { "1": "Alex", "2": "1234", "3": "Friday" },
  },
  {
    label: "Appointment Reminder",
    category: "UTILITY" as const,
    body: "Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}.",
    examples: { "1": "Alex", "2": "Monday", "3": "3 PM" },
  },
  {
    label: "Promo Offer",
    category: "MARKETING" as const,
    body: "Hi {{1}}, enjoy {{2}} off your next purchase! Use code {{3}} at checkout.",
    examples: { "1": "Alex", "2": "20%", "3": "SAVE20" },
  },
]

// Substitutes {{token}} with its example value where available, else leaves the placeholder visible
function renderWithExamples(text: string, examples: Record<string, string>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, token) => examples[token] || match)
}

function TemplatePreview({
  headerEnabled,
  headerText,
  headerExample,
  bodyText,
  bodyExamples,
  footerEnabled,
  footerText,
  buttons,
}: {
  headerEnabled: boolean
  headerText: string
  headerExample: string
  bodyText: string
  bodyExamples: Record<string, string>
  footerEnabled: boolean
  footerText: string
  buttons: ButtonDraft[]
}) {
  const headerToken = extractTokens(headerText)[0]
  const headerExamples: Record<string, string> = headerToken && headerExample ? { [headerToken]: headerExample } : {}

  return (
    <div className="sticky top-4 space-y-2">
      <Label className="text-xs text-muted-foreground">Template Preview</Label>
      {/* WhatsApp's chat ground, expressed through the theme: the doodle
          texture over a muted surface rather than a fixed beige that clashes
          with six of the seven palettes. */}
      <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-muted/60 p-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 doodle-wallpaper" />
        <div className="chat-bubble-in relative shadow-sm p-3 space-y-1 max-w-full">
          {headerEnabled && headerText && (
            <p className="text-sm font-bold whitespace-pre-wrap break-words">
              {renderWithExamples(headerText, headerExamples)}
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">
            {bodyText ? renderWithExamples(bodyText, bodyExamples) : (
              <span className="text-muted-foreground italic">Body text preview appears here</span>
            )}
          </p>
          {footerEnabled && footerText && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{footerText}</p>
          )}
        </div>
        {buttons.length > 0 && (
          <div className="mt-2 space-y-1">
            {buttons.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-center gap-2 rounded-lg bg-surface-2 shadow-sm py-2 text-sm text-info"
              >
                {b.type === "QUICK_REPLY" && <MessageCircle className="h-3.5 w-3.5" />}
                {b.type === "URL" && <ExternalLink className="h-3.5 w-3.5" />}
                {b.type === "PHONE_NUMBER" && <PhoneCall className="h-3.5 w-3.5" />}
                <span className="truncate">{b.text || "Button"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TemplatesPage({ params }: { params: Promise<{ wabaId: string }> }) {
  return (
    <React.Suspense fallback={null}>
      <TemplatesContent params={params} />
    </React.Suspense>
  )
}

function TemplatesContent({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const searchParams = useSearchParams()
  const wabaId = searchParams.get("wabaId") || ""
  const router = useRouter()
  // Sent here from a screen that needed a template (new chat, campaign…):
  // open the editor straight away, and go back there once it's submitted.
  const openNew = searchParams.get("new") === "1"
  const returnTo = safeReturnTo(searchParams.get("returnTo"))

  // Polls itself while Meta still has a template under review; the predicate is
  // evaluated against each result, so it stops once nothing is PENDING.
  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    error: templatesError,
    refetch: refetchTemplates,
  } = useWhatsappTemplates(unwrappedParams.wabaId, wabaId, {
    pollWhile: (rows) => rows.some((t) => t.status === "PENDING"),
  })
  const templates: WhatsappTemplate[] = useMemo(
    () => (Array.isArray(templatesData) ? templatesData : []),
    [templatesData],
  )
  const templatesLoadError = templatesError
    ? getErrorMessage(templatesError, "Failed to load templates")
    : null
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false)
  const [deletingTemplateName, setDeletingTemplateName] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  // Delete lives in each card's menu, which closes before a confirm could
  // open inside it — so the confirm is one dialog at page level.
  const [deleteTarget, setDeleteTarget] = useState<WhatsappTemplate | null>(null)
  // The editor opens above the gallery; bring it into view, or on a phone it
  // opened somewhere off-screen and the tap looked like it did nothing.
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [showForm, editingTemplate])

  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState("UTILITY")
  const [templateLanguage, setTemplateLanguage] = useState("en_US")

  const [headerEnabled, setHeaderEnabled] = useState(false)
  const [headerText, setHeaderText] = useState("")
  const [headerExample, setHeaderExample] = useState("")

  const [templateBody, setTemplateBody] = useState("")
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({})

  const [footerEnabled, setFooterEnabled] = useState(false)
  const [footerText, setFooterText] = useState("")

  const [buttons, setButtons] = useState<ButtonDraft[]>([])

  const headerTokens = headerEnabled ? extractTokens(headerText) : []
  const bodyTokens = extractTokens(templateBody)
  const bodyTokensOrdered = isPositional(bodyTokens)
    ? [...bodyTokens].sort((a, b) => Number(a) - Number(b))
    : bodyTokens

  const fetchTemplates = () => {
    refetchTemplates()
  }

  const handleDeleteTemplate = async (name: string) => {
    setDeletingTemplateName(name)
    try {
      await deleteWhatsappTemplate(name, unwrappedParams.wabaId, wabaId)
      toast.success("Template deleted")
      fetchTemplates()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to delete template")
    } finally {
      setDeletingTemplateName(null)
    }
  }

  const resetForm = () => {
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateCategory("UTILITY")
    setTemplateLanguage("en_US")
    setHeaderEnabled(false)
    setHeaderText("")
    setHeaderExample("")
    setTemplateBody("")
    setBodyExamples({})
    setFooterEnabled(false)
    setFooterText("")
    setButtons([])
    setShowForm(false)
  }

  const openCreateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openedNewRef = useRef(false)
  useEffect(() => {
    if (!openNew || !wabaId || openedNewRef.current) return
    openedNewRef.current = true
    setShowForm(true)
  }, [openNew, wabaId])

  const applyPreset = (preset: (typeof TEMPLATE_PRESETS)[number]) => {
    resetForm()
    setTemplateCategory(preset.category)
    setTemplateBody(preset.body)
    setBodyExamples(preset.examples)
    setShowForm(true)
  }

  // Parses a Meta components[] array into the individual form fields — shared by
  // "edit an existing template" and "prefill from an AI-generated template" (same shape).
  const applyTemplateFields = (name: string, category: string | undefined, language: string | undefined, components: TemplateComponent[]) => {
    setTemplateName(name)
    setTemplateCategory(category || "UTILITY")
    setTemplateLanguage(language || "en_US")

    const header = (components || []).find((c) => c.type === "HEADER")
    setHeaderEnabled(!!header)
    setHeaderText(header?.text || "")
    setHeaderExample(header?.example?.header_text?.[0] || "")

    const body = (components || []).find((c) => c.type === "BODY")
    setTemplateBody(body?.text || "")
    const positionalExamples = body?.example?.body_text?.[0] || []
    const namedExamples = body?.example?.body_text_named_params || []
    const tokens = extractTokens(body?.text || "")
    const examples: Record<string, string> = {}
    if (isPositional(tokens)) {
      const ordered = [...tokens].sort((a, b) => Number(a) - Number(b))
      ordered.forEach((tok, i) => (examples[tok] = positionalExamples[i] || ""))
    } else {
      namedExamples.forEach((p) => (examples[p.param_name] = p.example || ""))
    }
    setBodyExamples(examples)

    const footer = (components || []).find((c) => c.type === "FOOTER")
    setFooterEnabled(!!footer)
    setFooterText(footer?.text || "")

    const buttonsComponent = (components || []).find((c) => c.type === "BUTTONS")
    setButtons(
      (buttonsComponent?.buttons || []).map((b: TemplateButton) => ({
        type: b.type as ButtonDraft["type"],
        text: b.text || "",
        url: b.url || "",
        urlExample: b.example?.[0] || "",
        phoneNumber: b.phone_number || "",
      }))
    )
  }

  const openEditForm = (t: WhatsappTemplate) => {
    setEditingTemplate(t)
    applyTemplateFields(t.name, t.category, t.language, t.components || [])
    setShowForm(true)
  }

  const applyGeneratedTemplate = (t: GeneratedTemplate) => {
    resetForm()
    applyTemplateFields(t.name, t.category, t.language, t.components || [])
    setShowForm(true)
  }

  const addButton = () => {
    if (buttons.length >= 3) {
      toast.error("Max 3 buttons per template")
      return
    }
    setButtons([...buttons, { type: "QUICK_REPLY", text: "" }])
  }

  const updateButton = (index: number, patch: Partial<ButtonDraft>) => {
    setButtons(buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index))
  }

  // Builds the Meta components[] + parameter_format payload, or throws with a user-facing message
  const buildComponents = (): { components: TemplateComponent[]; parameter_format?: "POSITIONAL" | "NAMED" } => {
    if (templateCategory === "AUTHENTICATION") {
      throw new Error(
        "Authentication templates use a fixed structure Meta generates itself — this form doesn't build them. Create OTP templates in Meta Business Manager instead."
      )
    }

    const components: TemplateComponent[] = []

    if (headerEnabled) {
      if (!headerText) throw new Error("Header text is required when the header is enabled")
      if (headerTokens.length > 1) throw new Error("Header supports only one variable")
      const headerComponent: TemplateComponent = { type: "HEADER", format: "TEXT", text: headerText }
      if (headerTokens.length === 1) {
        // Meta's header only supports a single POSITIONAL variable, and it must be {{1}}.
        if (headerTokens[0] !== "1") throw new Error("Header variable must be {{1}} — Meta doesn't support named or other-numbered header variables")
        if (!headerExample) throw new Error("Provide an example value for the header variable")
        headerComponent.example = { header_text: [headerExample] }
      }
      components.push(headerComponent)
    }

    if (!templateBody) throw new Error("Body text is required")
    const bodyComponent: TemplateComponent = { type: "BODY", text: templateBody }
    // Meta only accepts parameter_format for NAMED params — POSITIONAL is the
    // implicit default and sending it explicitly gets the create rejected.
    let parameterFormat: "POSITIONAL" | "NAMED" | undefined
    if (bodyTokens.length > 0) {
      const named = !isPositional(bodyTokens)
      if (named) parameterFormat = "NAMED"
      if (!named && bodyTokensOrdered.some((tok, i) => Number(tok) !== i + 1)) {
        throw new Error("Positional variables must run sequentially from {{1}} with no gaps (e.g. {{1}}, {{2}}, {{3}})")
      }
      if (bodyTokensOrdered.some((tok) => !bodyExamples[tok])) {
        throw new Error("Provide example values for all body variables")
      }
      bodyComponent.example = named
        ? { body_text_named_params: bodyTokensOrdered.map((tok) => ({ param_name: tok, example: bodyExamples[tok] })) }
        : { body_text: [bodyTokensOrdered.map((tok) => bodyExamples[tok])] }
    }
    components.push(bodyComponent)

    if (footerEnabled) {
      if (!footerText) throw new Error("Footer text is required when the footer is enabled")
      components.push({ type: "FOOTER", text: footerText })
    }

    if (buttons.length > 0) {
      const builtButtons = buttons.map((b) => {
        if (!b.text) throw new Error("All buttons need button text")
        if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text }
        if (b.type === "URL") {
          if (!b.url) throw new Error("URL buttons need a URL")
          const btn: TemplateButton = { type: "URL", text: b.text, url: b.url }
          if (extractTokens(b.url).length > 0) {
            if (!b.urlExample) throw new Error("Provide an example URL for the dynamic button URL")
            btn.example = [b.urlExample]
          }
          return btn
        }
        if (!b.phoneNumber) throw new Error("Phone number buttons need a phone number")
        return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber }
      })
      components.push({ type: "BUTTONS", buttons: builtButtons })
    }

    return { components, parameter_format: parameterFormat }
  }

  const handleSubmitTemplate = async () => {
    if (!templateName) {
      toast.error("Template name is required")
      return
    }
    let payload: { components: TemplateComponent[]; parameter_format?: "POSITIONAL" | "NAMED" }
    try {
      payload = buildComponents()
    } catch (err) {
      toast.error(getErrorMessage(err))
      return
    }

    setIsSubmittingTemplate(true)
    try {
      if (editingTemplate) {
        await updateWhatsappTemplate(editingTemplate.id ?? "", {
          accountId: unwrappedParams.wabaId,
          category: templateCategory,
          components: payload.components,
          ...(payload.parameter_format ? { parameter_format: payload.parameter_format } : {}),
        })
        toast.success("Template updated and resubmitted for review")
      } else {
        await createWhatsappTemplate({
          accountId: unwrappedParams.wabaId,
          wabaId,
          template: {
            name: templateName,
            category: templateCategory,
            language: templateLanguage,
            components: payload.components,
            ...(payload.parameter_format ? { parameter_format: payload.parameter_format } : {}),
          },
        })
        toast.success("Template submitted for review")
        if (returnTo) {
          // In review now; the screen that sent us here shows it as such and
          // fills in on its own once Meta approves. Refresh the shared cache
          // first so it arrives already knowing about this one.
          void fetchTemplates()
          router.push(returnTo)
          return
        }
      }
      resetForm()
      fetchTemplates()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to save template")
    } finally {
      setIsSubmittingTemplate(false)
    }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of templates) if (t.status) counts[t.status] = (counts[t.status] ?? 0) + 1
    return counts
  }, [templates])
  const visibleTemplates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates
      .filter((t) => !statusFilter || t.status === statusFilter)
      .filter((t) => {
        if (!q) return true
        const body = (t.components ?? []).find((c) => c.type === "BODY")?.text ?? ""
        return t.name.toLowerCase().includes(q) || body.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [templates, statusFilter, search])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every conversation you start goes out as an approved{" "}
          <Explain term="template">message template</Explain>. Meta reviews each one, usually in
          minutes — <Explain term="template-status">the status</Explain> tells you where it is.
        </p>
        {wabaId && (
          <div className="flex flex-wrap items-center gap-2">
            <AITemplateGeneratorDialog
              accountId={unwrappedParams.wabaId}
              wabaId={wabaId}
              onUseTemplate={applyGeneratedTemplate}
            />
            <Button onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" /> New template
            </Button>
          </div>
        )}
      </div>

      {/* Kept beside the open editor when sent here to create one: a starter
          is the quickest way to something Meta will approve. */}
      {wabaId && (!showForm || (openNew && !editingTemplate)) && (
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          <span className="shrink-0 text-xs text-muted-foreground">Start from:</span>
          {TEMPLATE_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {showForm ? (
        <div ref={formRef} className="grid scroll-mt-4 grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4 p-4 border rounded-md">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{editingTemplate ? `Edit "${editingTemplate.name}"` : "New Template"}</h4>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {returnTo && !editingTemplate && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Once you submit it, you&apos;ll go back to where you were. It can be sent as soon as Meta approves it.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={templateName}
              disabled={!!editingTemplate}
              onChange={(e) =>
                setTemplateName(
                  e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                    .replace(/[^a-z0-9_]/g, "")
                )
              }
              placeholder="order_confirmation"
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-category">
              Category
              <Explain term="template-category" />
            </Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger id="template-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTILITY">Utility</SelectItem>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
              </SelectContent>
            </Select>
            {templateCategory === "AUTHENTICATION" && (
              <p className="text-xs text-destructive">
                Not supported here — Meta generates authentication (OTP) templates from a fixed structure. Create these in Meta Business Manager instead.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-language">Language</Label>
            <Input
              id="template-language"
              value={templateLanguage}
              disabled={!!editingTemplate}
              onChange={(e) => setTemplateLanguage(e.target.value)}
              placeholder="en_US"
            />
          </div>

          <div className="space-y-2 p-3 border rounded-md">
            <div className="flex items-center gap-2">
              <Checkbox
                id="header-enabled"
                checked={headerEnabled}
                onCheckedChange={(v) => setHeaderEnabled(!!v)}
              />
              <Label htmlFor="header-enabled">Add header</Label>
            </div>
            {headerEnabled && (
              <>
                <Input
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="Header text (optional {{1}} variable)"
                />
                {headerTokens.length === 1 && (
                  <Input
                    value={headerExample}
                    onChange={(e) => setHeaderExample(e.target.value)}
                    placeholder={`Example value for header {{${headerTokens[0]}}}`}
                  />
                )}
              </>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template-body">Body</Label>
            <Textarea
              id="template-body"
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              placeholder="Hi {{1}}, your order is confirmed."
            />
            {bodyTokensOrdered.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  Example values (required by Meta for review):
                </p>
                {bodyTokensOrdered.map((tok) => (
                  <Input
                    key={tok}
                    value={bodyExamples[tok] || ""}
                    onChange={(e) => setBodyExamples({ ...bodyExamples, [tok]: e.target.value })}
                    placeholder={`Example for {{${tok}}}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 p-3 border rounded-md">
            <div className="flex items-center gap-2">
              <Checkbox
                id="footer-enabled"
                checked={footerEnabled}
                onCheckedChange={(v) => setFooterEnabled(!!v)}
              />
              <Label htmlFor="footer-enabled">Add footer</Label>
            </div>
            {footerEnabled && (
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Footer text (static, no variables)"
              />
            )}
          </div>

          <div className="space-y-2 p-3 border rounded-md">
            <div className="flex items-center justify-between">
              <Label>Buttons ({buttons.length}/3)</Label>
              <Button variant="outline" size="sm" onClick={addButton} disabled={buttons.length >= 3}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Button
              </Button>
            </div>
            {buttons.map((b, i) => (
              <div key={i} className="space-y-2 p-2 border rounded-md">
                <div className="flex items-center gap-2">
                  <Select
                    value={b.type}
                    onValueChange={(v) => updateButton(i, { type: v as ButtonDraft["type"] })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                      <SelectItem value="URL">URL</SelectItem>
                      <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={b.text}
                    onChange={(e) => updateButton(i, { text: e.target.value })}
                    placeholder="Button text"
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeButton(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {b.type === "URL" && (
                  <>
                    <Input
                      value={b.url || ""}
                      onChange={(e) => updateButton(i, { url: e.target.value })}
                      placeholder="https://example.com/{{1}} (optional variable)"
                    />
                    {extractTokens(b.url || "").length > 0 && (
                      <Input
                        value={b.urlExample || ""}
                        onChange={(e) => updateButton(i, { urlExample: e.target.value })}
                        placeholder="Example full URL"
                      />
                    )}
                  </>
                )}
                {b.type === "PHONE_NUMBER" && (
                  <Input
                    value={b.phoneNumber || ""}
                    onChange={(e) => updateButton(i, { phoneNumber: e.target.value })}
                    placeholder="+15556613879"
                  />
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSubmitTemplate} disabled={isSubmittingTemplate} className="w-full">
            {isSubmittingTemplate ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : editingTemplate ? (
              "Save Changes"
            ) : (
              "Submit Template"
            )}
          </Button>
        </div>

        <TemplatePreview
          headerEnabled={headerEnabled}
          headerText={headerText}
          headerExample={headerExample}
          bodyText={templateBody}
          bodyExamples={bodyExamples}
          footerEnabled={footerEnabled}
          footerText={footerText}
          buttons={buttons}
        />
        </div>
      ) : null}

      {!wabaId ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive-soft p-4 text-sm text-destructive">
          Missing WABA ID in the URL — go back to step 2 and reselect your account before managing
          templates.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates"
                className="pl-9"
                aria-label="Search templates"
              />
            </div>
            {templates.length > 0 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {[null, ...Object.keys(statusCounts).sort()].map((status) => {
                  const active = statusFilter === status
                  const count = status ? statusCounts[status] : templates.length
                  return (
                    <button
                      key={status ?? "all"}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors duration-fast ease-out-soft",
                        active
                          ? "border-primary/40 bg-primary-soft text-primary-emphasis"
                          : "border-border-subtle text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {status ? status.toLowerCase().replace(/_/g, " ") : "All"}
                      <span className="tabular-nums opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {isLoadingTemplates ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          ) : templatesLoadError ? (
            <EmptyState
              icon={FileText}
              title="Couldn't load your templates"
              description={`${templatesLoadError}. Approved templates stay approved — Meta holds them, and this is only our copy of the list.`}
              action={
                <Button variant="outline" onClick={fetchTemplates}>
                  Try again
                </Button>
              }
            />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description="Meta requires a pre-approved template before you can start a conversation. Start from one above, write your own, or let the assistant draft it."
              hint="Review usually takes minutes. Utility templates are approved more often than marketing ones."
              action={
                <Button onClick={openCreateForm}>
                  <Plus className="mr-2 h-4 w-4" /> New template
                </Button>
              }
            />
          ) : visibleTemplates.length === 0 ? (
            <EmptyState
              plain
              icon={Search}
              title="No templates match"
              description="Try a different search or status."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("")
                    setStatusFilter(null)
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((t, i) => (
                <TemplateCard
                  key={t.id || t.name}
                  template={t}
                  index={i}
                  editable={EDITABLE_STATUSES.has(t.status ?? "")}
                  deleting={deletingTemplateName === t.name}
                  onEdit={() => openEditForm(t)}
                  onDelete={() => setDeleteTarget(t)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the template on Meta&apos;s side, not just locally. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) handleDeleteTemplate(deleteTarget.name)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
