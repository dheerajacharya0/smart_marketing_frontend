"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { checkRecipient, digitsOf } from "@/lib/phone-number"
import { parseCsv, toCsv, withTags } from "@/lib/csv"
import { swallow } from "@/lib/observability"
import { AlertTriangle, Check, FileUp, Loader2, Download, Tag, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "react-hot-toast"
import { importContactsCsv, listContactTags, type ContactImportResult } from "@/services/api"
import { TagChipsEditor } from "@/components/contacts/tag-chips-editor"

const SAMPLE_CSV = `phone,name,tags,opted_in,city
+91 98765 43210,John Doe,vip;retail,yes,Pune
919812345678,Jane Smith,wholesale,no,Mumbai
`

const PREVIEW_ROWS = 10

/** Tags one upload may stamp on its contacts. */
const MAX_UPLOAD_TAGS = 5

/** Matches the API's limit on an import body (backend main.ts), less JSON overhead. */
const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024

/** Rows shown in the fix-up table; "Skip all" covers the rest. */
const MAX_FIX_ROWS = 100

/** A spreadsheet, either kind. Legacy binary .xls is not read. */
const ACCEPTED = /\.(csv|xlsx)$/i

type Step = "pick" | "preview" | "result"

export interface ImportSummary {
  result: ContactImportResult
  /** Tags stamped on every imported row — what a campaign can then target. */
  tags: string[]
}

export function CsvImportDialog({
  open,
  onOpenChange,
  accountId,
  onImported,
  defaultTags,
  doneLabel = "Done",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  onImported: (summary: ImportSummary) => void
  /** Tags pre-filled for this upload (e.g. "upload-4-oct" from the campaign wizard). */
  defaultTags?: string[]
  /** Label of the button that closes the dialog after a successful import. */
  doneLabel?: string
}) {
  const [step, setStep] = useState<Step>("pick")
  const [fileName, setFileName] = useState("")
  const [csvText, setCsvText] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ContactImportResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Corrections typed into the fix-up table, keyed by row index.
  const [fixes, setFixes] = useState<Record<number, string>>({})
  // Rows the user chose to leave out rather than correct.
  const [skipped, setSkipped] = useState<Record<number, boolean>>({})
  const [tags, setTags] = useState<string[]>(defaultTags ?? [])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Each opening starts from the caller's suggestion, and offers the
  // account's existing tags so an upload can join a list it already keeps.
  useEffect(() => {
    if (!open) return
    setTags(defaultTags ?? [])
    listContactTags(accountId)
      .then((res) => setKnownTags(Array.isArray(res) ? res.map((t) => t.tag) : []))
      .catch(swallow("app/dashboard/contacts/csv-import-dialog.tsx"))
    // defaultTags is read once per opening, not tracked: a new array from the
    // parent on every render would wipe what the user picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId])

  const reset = () => {
    setStep("pick")
    setFileName("")
    setCsvText("")
    setResult(null)
    setIsDragging(false)
    setFixes({})
    setSkipped({})
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      if (step === "result" && result) onImported({ result, tags })
      reset()
    }
  }

  const loadFile = async (file: File) => {
    if (!ACCEPTED.test(file.name)) {
      toast.error("Pick a .csv or .xlsx file")
      return
    }
    setIsReading(true)
    try {
      let text: string
      if (/\.xlsx$/i.test(file.name)) {
        // Loaded on demand: the unzip code is only worth shipping to people
        // who actually upload a workbook.
        const { xlsxToCsv } = await import("@/lib/xlsx")
        text = xlsxToCsv(new Uint8Array(await file.arrayBuffer()))
      } else {
        text = await file.text()
      }
      if (!text.trim()) {
        toast.error("File is empty")
        return
      }
      setFileName(file.name)
      setCsvText(text)
      setStep("preview")
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to read file")
    } finally {
      setIsReading(false)
    }
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "contacts-sample.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const parsed = useMemo(() => parseCsv(csvText), [csvText])
  const hasPhoneColumn = parsed.phoneIndex >= 0

  /**
   * Every row's number checked against its own country's numbering plan —
   * the same rule the API applies, run here so a bad row is a row the user can
   * fix, not a 400 on the whole file. A row the user typed a correction for is
   * checked as corrected.
   *
   * Punctuation is stripped before the check rather than failing the row:
   * `+91 98765 43210` out of a spreadsheet is a real number, and `buildCsv`
   * rewrites every cell to bare digits anyway. A wrong *count* of digits is
   * the failure that matters, and stripping separators doesn't hide it.
   */
  const rowChecks = useMemo(() => {
    if (!hasPhoneColumn) return []
    return parsed.rows.map((row, i) =>
      checkRecipient(digitsOf(fixes[i] ?? row[parsed.phoneIndex] ?? ""))
    )
  }, [parsed, fixes, hasPhoneColumn])

  /**
   * Rows the *file* arrived with a bad number on. Deliberately not derived from
   * `fixes` — a row that vanished from the table the moment its last digit was
   * typed would take the focused input with it. It stays listed, and turns from
   * a problem into a tick.
   */
  const problemRows = useMemo(() => {
    if (!hasPhoneColumn) return []
    return parsed.rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => !checkRecipient(digitsOf(row[parsed.phoneIndex] ?? "")).valid)
      .map(({ i }) => i)
  }, [parsed, hasPhoneColumn])

  const unresolvedRows = problemRows.filter((i) => !skipped[i] && !rowChecks[i]?.valid)
  const skippedCount = parsed.rows.filter((_, i) => skipped[i]).length
  const importableCount = parsed.rows.length - skippedCount

  /**
   * The file as it will actually be sent: skipped rows dropped, corrections
   * applied, and every number rewritten to bare digits — the form Meta echoes
   * back as `wa_id`, so the thread for an imported contact is keyed the same
   * way as one created from the inbox.
   */
  const buildCsv = () => {
    if (!hasPhoneColumn) return toCsv(withTags(parsed, tags))
    const rows = parsed.rows
      .map((row, i) => {
        if (skipped[i]) return null
        const next = [...row]
        next[parsed.phoneIndex] = rowChecks[i]?.digits ?? next[parsed.phoneIndex]
        return next
      })
      .filter((row): row is string[] => row !== null)
    return toCsv(withTags({ ...parsed, rows }, tags))
  }

  const handleImport = async () => {
    if (unresolvedRows.length > 0) return
    const csv = buildCsv()
    // The API takes up to 10 MB; say so here rather than after the upload.
    if (new Blob([csv]).size > MAX_UPLOAD_BYTES) {
      toast.error("This file is too large to upload at once. Split it into files of about 100,000 rows.")
      return
    }
    setIsImporting(true)
    try {
      const data = await importContactsCsv(accountId, csv)
      setResult(data)
      setStep("result")
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const previewHeader = parsed.header
  const previewRows = parsed.rows.slice(0, PREVIEW_ROWS)
  const totalDataRows = parsed.rows.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload contacts</DialogTitle>
          <DialogDescription>
            {step === "pick" &&
              "Upload a CSV or Excel (.xlsx) file. Existing contacts (matched by phone) are updated, new ones created."}
            {step === "preview" && `Preview of ${fileName} — confirm to import.`}
            {step === "result" && "Import finished."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-4">
            {/* A real button, not a clickable div. The file input is
                `display: none`, so it is not in the tab order, and while this
                zone was a div the only way to reach the browse dialog was a
                mouse — a keyboard user could not import contacts at all. The
                input stays hidden and stays a sibling: a form control nested
                inside a button is invalid HTML. */}
            <button
              type="button"
              disabled={isReading}
              className={`focus-ring flex w-full flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
                isDragging ? "border-primary bg-accent" : "border-muted-foreground/25"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) loadFile(file)
              }}
            >
              {isReading ? (
                <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {isReading ? "Reading the file..." : "Tap to choose a .csv or .xlsx file, or drop one here"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) loadFile(file)
                e.target.value = ""
              }}
            />

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Expected format</p>
              <p>
                First row is the header. Recognized columns (case-insensitive):{" "}
                <code>phone</code> (or <code>waId</code>/<code>wa_id</code>/<code>number</code>/<code>whatsapp</code> —
                required), <code>name</code>, <code>tags</code> (separated by <code>;</code> or <code>|</code>),{" "}
                <code>opted_in</code> (yes/no/true/false/1/0). Any other column becomes a custom attribute
                you can use in messages. Rows marked <code>opted_in</code> = no count as opted out and are
                never messaged. From Google Sheets: File → Download → CSV or Excel.
              </p>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={downloadSample}>
                <Download className="mr-1 h-3 w-3" /> Download sample CSV
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {totalDataRows} row{totalDataRows === 1 ? "" : "s"} found
              {totalDataRows > PREVIEW_ROWS ? ` — showing first ${PREVIEW_ROWS}` : ""}.
              {skippedCount > 0 ? ` ${skippedCount} skipped.` : ""}
            </p>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Tag everyone in this file</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Added to each contact&apos;s own tags, so you can send to exactly this upload later. Nobody
                loses a tag they already have.
              </p>
              <TagChipsEditor
                value={tags}
                onChange={setTags}
                knownTags={knownTags}
                max={MAX_UPLOAD_TAGS}
                placeholder="New tag, e.g. diwali-leads"
                createLabel="Create"
                emptyText="No tags — contacts keep only the tags in the file."
                suggestionLimit={8}
              />
            </div>

            {!hasPhoneColumn && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>
                  No phone column found, so the numbers can&apos;t be checked here. The import will
                  still run and the server will report any rows it can&apos;t read.
                </p>
              </div>
            )}

            {problemRows.length > 0 && (
              <div className="space-y-2">
                <div
                  className={
                    unresolvedRows.length > 0
                      ? "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                      : "flex items-start gap-2 rounded-md border border-success/40 bg-success-soft p-3 text-sm"
                  }
                >
                  {unresolvedRows.length > 0 ? (
                    <>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <p>
                        {unresolvedRows.length} row{unresolvedRows.length === 1 ? " has" : "s have"} a
                        number WhatsApp would reject. Correct{" "}
                        {unresolvedRows.length === 1 ? "it" : "them"} below or skip{" "}
                        {unresolvedRows.length === 1 ? "that row" : "those rows"} — the rest of the
                        file imports either way.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-8 shrink-0"
                        onClick={() =>
                          setSkipped((prev) => ({
                            ...prev,
                            ...Object.fromEntries(unresolvedRows.map((i) => [i, true])),
                          }))
                        }
                      >
                        Skip all
                      </Button>
                    </>
                  ) : (
                    <>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <p>
                        All {problemRows.length} flagged row
                        {problemRows.length === 1 ? " is" : "s are"} sorted — corrected or skipped.
                      </p>
                    </>
                  )}
                </div>

                {problemRows.length > MAX_FIX_ROWS && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {MAX_FIX_ROWS} of {problemRows.length}. If most numbers are missing
                    the country code, fix the file and upload it again.
                  </p>
                )}
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table className="min-w-[32rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Line</TableHead>
                        <TableHead className="w-52">Number</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* A file with the country code missing everywhere flags
                          every row; thousands of inputs froze the dialog. */}
                      {problemRows.slice(0, MAX_FIX_ROWS).map((i) => {
                        const isSkipped = !!skipped[i]
                        return (
                          <TableRow key={i} className={isSkipped ? "opacity-50" : undefined}>
                            {/* +2: the header is line 1 and rows are 0-indexed,
                                so this matches what a spreadsheet shows. */}
                            <TableCell className="tabular-nums">{i + 2}</TableCell>
                            <TableCell>
                              <Input
                                value={fixes[i] ?? parsed.rows[i]?.[parsed.phoneIndex] ?? ""}
                                onChange={(e) =>
                                  setFixes((prev) => ({ ...prev, [i]: e.target.value }))
                                }
                                disabled={isSkipped}
                                className="h-8"
                                aria-label={`Number on line ${i + 2}`}
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {isSkipped ? (
                                "Skipped — won't be imported"
                              ) : rowChecks[i]?.valid ? (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <Check className="h-3.5 w-3.5" /> Fixed — sends to{" "}
                                  <span className="tabular-nums">{rowChecks[i]?.digits}</span>
                                </span>
                              ) : (
                                rowChecks[i]?.message
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() =>
                                  setSkipped((prev) => ({ ...prev, [i]: !prev[i] }))
                                }
                              >
                                {isSkipped ? (
                                  <>
                                    <Undo2 className="mr-1 h-3.5 w-3.5" /> Keep
                                  </>
                                ) : (
                                  "Skip"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewHeader.map((h, i) => (
                      <TableHead key={i}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {previewHeader.map((_, j) => (
                        <TableCell key={j} className="text-sm">
                          {row[j] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
              <div className="rounded-md border p-3">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Rows</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-bold text-success">{result.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-bold text-info">{result.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
            </div>

            {tags.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Tagged <span className="font-medium text-foreground">{tags.join(", ")}</span>.
              </p>
            )}

            {result.skipped?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Skipped rows ({result.skipped.length})</p>
                <div className="rounded-md border max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Line</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.skipped.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>{s.line}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "pick" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset} disabled={isImporting}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || unresolvedRows.length > 0 || importableCount === 0}
              >
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {importableCount} contact{importableCount === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={() => handleOpenChange(false)}>{doneLabel}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
