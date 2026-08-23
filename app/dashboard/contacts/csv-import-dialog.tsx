"use client"

import { useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { checkRecipient, digitsOf } from "@/lib/phone-number"
import { AlertTriangle, Check, FileUp, Loader2, Download, Undo2 } from "lucide-react"
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
import { importContactsCsv, type ContactImportResult } from "@/services/api"

const SAMPLE_CSV = `phone,name,tags,opted_in,city
+91 98765 43210,John Doe,vip;retail,yes,Pune
919812345678,Jane Smith,wholesale,no,Mumbai
`

const PREVIEW_ROWS = 10

// Minimal CSV line parser for the preview table only — handles quoted fields
// with embedded commas; the backend does the authoritative parse.
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      fields.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/** Inverse of `parseCsvLine` — quotes only the fields that need it. */
function serializeCsvLine(fields: string[]): string {
  return fields
    .map((field) => (/[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field))
    .join(",")
}

/** Header names the backend accepts for the number column, lower-cased. */
const PHONE_HEADERS = ["phone", "waid", "wa_id", "number", "whatsapp"]

interface ParsedCsv {
  header: string[]
  rows: string[][]
  /** Index of the number column, or -1 when the file names none. */
  phoneIndex: number
}

function parseCsv(text: string): ParsedCsv {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0] ? parseCsvLine(lines[0]) : []
  const phoneIndex = header.findIndex((h) =>
    PHONE_HEADERS.includes(h.trim().toLowerCase().replace(/\s+/g, "_"))
  )
  return { header, rows: lines.slice(1).map(parseCsvLine), phoneIndex }
}

type Step = "pick" | "preview" | "result"

export function CsvImportDialog({
  open,
  onOpenChange,
  accountId,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  onImported: () => void
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      if (step === "result") onImported()
      reset()
    }
  }

  const loadFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Pick a .csv file")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || "")
      if (!text.trim()) {
        toast.error("File is empty")
        return
      }
      setFileName(file.name)
      setCsvText(text)
      setStep("preview")
    }
    reader.onerror = () => toast.error("Failed to read file")
    reader.readAsText(file)
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
    if (!hasPhoneColumn) return csvText
    const rows = parsed.rows
      .map((row, i) => {
        if (skipped[i]) return null
        const next = [...row]
        next[parsed.phoneIndex] = rowChecks[i]?.digits ?? next[parsed.phoneIndex]
        return serializeCsvLine(next)
      })
      .filter((line): line is string => line !== null)
    return [serializeCsvLine(parsed.header), ...rows].join("\n")
  }

  const handleImport = async () => {
    if (unresolvedRows.length > 0) return
    setIsImporting(true)
    try {
      const data = await importContactsCsv(accountId, buildCsv())
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
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === "pick" && "Upload a CSV file. Existing contacts (matched by phone) are updated, new ones created."}
            {step === "preview" && `Preview of ${fileName} — confirm to import.`}
            {step === "result" && "Import finished."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-4">
            <div
              className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 cursor-pointer transition-colors ${
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
              <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drop a .csv file here or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) loadFile(file)
                  e.target.value = ""
                }}
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Expected format</p>
              <p>
                First row is the header. Recognized columns (case-insensitive):{" "}
                <code>phone</code> (or <code>waId</code>/<code>wa_id</code>/<code>number</code>/<code>whatsapp</code> —
                required), <code>name</code>, <code>tags</code> (separated by <code>;</code> or <code>|</code>),{" "}
                <code>opted_in</code> (yes/no/true/false/1/0). Any other column becomes a custom attribute.
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

                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Line</TableHead>
                        <TableHead className="w-52">Number</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {problemRows.map((i) => {
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
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Rows processed</p>
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
          {step === "result" && <Button onClick={() => handleOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
