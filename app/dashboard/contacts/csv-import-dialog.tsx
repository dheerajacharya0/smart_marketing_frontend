"use client"

import { useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { FileUp, Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep("pick")
    setFileName("")
    setCsvText("")
    setResult(null)
    setIsDragging(false)
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

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const data = await importContactsCsv(accountId, csvText)
      setResult(data)
      setStep("result")
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const previewLines = csvText.trim().split(/\r?\n/)
  const previewHeader = previewLines[0] ? parseCsvLine(previewLines[0]) : []
  const previewRows = previewLines.slice(1, 1 + PREVIEW_ROWS).map(parseCsvLine)
  const totalDataRows = Math.max(previewLines.length - 1, 0)

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
            </p>
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
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
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
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {totalDataRows} contact{totalDataRows === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={() => handleOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
