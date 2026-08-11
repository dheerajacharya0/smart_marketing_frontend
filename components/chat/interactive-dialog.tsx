"use client"

import { useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Loader2, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { InteractiveInput } from "@/services/api"

// Cloud API limits — mirrored client-side for friendly validation
const BODY_MAX = 1024
const BUTTON_TITLE_MAX = 20
const LIST_BUTTON_MAX = 20
const ROW_TITLE_MAX = 24
const ROW_DESC_MAX = 72
const MAX_BUTTONS = 3
const MAX_ROWS_TOTAL = 10

export type InteractiveKind = "buttons" | "list"

// ids are auto-generated (slug of title + position) — users never type them
function slugId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return `${slug || "option"}-${index + 1}`
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs ${value > max ? "text-destructive" : "text-muted-foreground"}`}>
      {value}/{max}
    </span>
  )
}

interface SectionDraft {
  title: string
  rows: { title: string; description: string }[]
}

export function InteractiveDialog({
  open,
  onOpenChange,
  kind,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: InteractiveKind
  // Resolves on success; rejects with an Error whose message is shown inline.
  onSend: (input: InteractiveInput) => Promise<void>
}) {
  const [bodyText, setBodyText] = useState("")
  const [headerText, setHeaderText] = useState("")
  const [footerText, setFooterText] = useState("")
  const [buttons, setButtons] = useState<string[]>([""])
  const [buttonText, setButtonText] = useState("")
  const [sections, setSections] = useState<SectionDraft[]>([{ title: "", rows: [{ title: "", description: "" }] }])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBodyText("")
    setHeaderText("")
    setFooterText("")
    setButtons([""])
    setButtonText("")
    setSections([{ title: "", rows: [{ title: "", description: "" }] }])
    setError(null)
  }, [open, kind])

  const totalRows = useMemo(() => sections.reduce((n, s) => n + s.rows.length, 0), [sections])

  const validationError = useMemo((): string | null => {
    if (!bodyText.trim()) return "Body text is required"
    if (bodyText.length > BODY_MAX) return `Body text is over ${BODY_MAX} characters`
    if (kind === "buttons") {
      const titles = buttons.map((b) => b.trim()).filter(Boolean)
      if (titles.length === 0) return "Add at least one button"
      if (buttons.some((b) => !b.trim())) return "Fill in every button title"
      if (buttons.some((b) => b.trim().length > BUTTON_TITLE_MAX))
        return `Button titles are limited to ${BUTTON_TITLE_MAX} characters`
    } else {
      if (!buttonText.trim()) return "Menu button text is required"
      if (buttonText.trim().length > LIST_BUTTON_MAX)
        return `Menu button text is limited to ${LIST_BUTTON_MAX} characters`
      if (totalRows === 0) return "Add at least one row"
      if (totalRows > MAX_ROWS_TOTAL) return `At most ${MAX_ROWS_TOTAL} rows across all sections`
      for (const s of sections) {
        for (const r of s.rows) {
          if (!r.title.trim()) return "Fill in every row title"
          if (r.title.trim().length > ROW_TITLE_MAX) return `Row titles are limited to ${ROW_TITLE_MAX} characters`
          if (r.description.length > ROW_DESC_MAX)
            return `Row descriptions are limited to ${ROW_DESC_MAX} characters`
        }
      }
    }
    return null
  }, [kind, bodyText, buttons, buttonText, sections, totalRows])

  const handleSend = async () => {
    if (validationError) return
    setError(null)
    setIsSending(true)
    try {
      const common = {
        bodyText: bodyText.trim(),
        ...(headerText.trim() ? { headerText: headerText.trim() } : {}),
        ...(footerText.trim() ? { footerText: footerText.trim() } : {}),
      }
      const input: InteractiveInput =
        kind === "buttons"
          ? {
              kind: "buttons",
              ...common,
              buttons: buttons.map((title, i) => ({ id: slugId(title, i), title: title.trim() })),
            }
          : {
              kind: "list",
              ...common,
              buttonText: buttonText.trim(),
              sections: sections.map((s, si) => ({
                ...(s.title.trim() ? { title: s.title.trim() } : {}),
                rows: s.rows.map((r, ri) => ({
                  id: slugId(r.title, si * MAX_ROWS_TOTAL + ri),
                  title: r.title.trim(),
                  ...(r.description.trim() ? { description: r.description.trim() } : {}),
                })),
              })),
            }
      await onSend(input)
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "buttons" ? "Reply Buttons" : "List Message"}</DialogTitle>
          <DialogDescription>
            {kind === "buttons"
              ? "Up to 3 quick-reply buttons the contact can tap."
              : "A tappable menu of up to 10 rows, grouped into sections."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ib-body">Body text</Label>
              <Counter value={bodyText.length} max={BODY_MAX} />
            </div>
            <Textarea id="ib-body" value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ib-header">Header (optional)</Label>
              <Input id="ib-header" value={headerText} onChange={(e) => setHeaderText(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ib-footer">Footer (optional)</Label>
              <Input id="ib-footer" value={footerText} onChange={(e) => setFooterText(e.target.value)} />
            </div>
          </div>

          <Separator />

          {kind === "buttons" ? (
            <div className="space-y-2">
              <Label>Buttons</Label>
              {buttons.map((title, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setButtons((prev) => prev.map((b, idx) => (idx === i ? e.target.value : b)))}
                    placeholder={`Button ${i + 1}`}
                    className="flex-1"
                  />
                  <Counter value={title.length} max={BUTTON_TITLE_MAX} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={buttons.length === 1}
                    onClick={() => setButtons((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {buttons.length < MAX_BUTTONS && (
                <Button variant="outline" size="sm" onClick={() => setButtons((prev) => [...prev, ""])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add button
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ib-btn-text">Menu button text</Label>
                  <Counter value={buttonText.length} max={LIST_BUTTON_MAX} />
                </div>
                <Input
                  id="ib-btn-text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="View menu"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Sections</Label>
                <Badge variant={totalRows > MAX_ROWS_TOTAL ? "destructive" : "outline"}>
                  {totalRows}/{MAX_ROWS_TOTAL} rows
                </Badge>
              </div>

              {sections.map((section, si) => (
                <div key={si} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s, idx) => (idx === si ? { ...s, title: e.target.value } : s))
                        )
                      }
                      placeholder={`Section ${si + 1} title (optional)`}
                      className="flex-1 h-8"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sections.length === 1}
                      onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== si))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {section.rows.map((row, ri) => (
                    <div key={ri} className="space-y-1 rounded bg-muted/50 p-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={row.title}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((s, sIdx) =>
                                sIdx === si
                                  ? {
                                      ...s,
                                      rows: s.rows.map((r, rIdx) =>
                                        rIdx === ri ? { ...r, title: e.target.value } : r
                                      ),
                                    }
                                  : s
                              )
                            )
                          }
                          placeholder="Row title"
                          className="flex-1 h-8"
                        />
                        <Counter value={row.title.length} max={ROW_TITLE_MAX} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={section.rows.length === 1 && sections.length === 1 && si === 0}
                          onClick={() =>
                            setSections((prev) =>
                              prev
                                .map((s, sIdx) =>
                                  sIdx === si ? { ...s, rows: s.rows.filter((_, rIdx) => rIdx !== ri) } : s
                                )
                                .filter((s) => s.rows.length > 0)
                            )
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((s, sIdx) =>
                                sIdx === si
                                  ? {
                                      ...s,
                                      rows: s.rows.map((r, rIdx) =>
                                        rIdx === ri ? { ...r, description: e.target.value } : r
                                      ),
                                    }
                                  : s
                              )
                            )
                          }
                          placeholder="Description (optional)"
                          className="flex-1 h-8"
                        />
                        <Counter value={row.description.length} max={ROW_DESC_MAX} />
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={totalRows >= MAX_ROWS_TOTAL}
                    onClick={() =>
                      setSections((prev) =>
                        prev.map((s, idx) =>
                          idx === si ? { ...s, rows: [...s.rows, { title: "", description: "" }] } : s
                        )
                      )
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add row
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                disabled={totalRows >= MAX_ROWS_TOTAL}
                onClick={() =>
                  setSections((prev) => [...prev, { title: "", rows: [{ title: "", description: "" }] }])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add section
              </Button>
            </div>
          )}

          {(validationError || error) && (
            <p className="text-sm text-destructive">{error || validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!!validationError || isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
