import { strFromU8, unzipSync } from "fflate"
import { serializeCsvLine } from "./csv"

/**
 * The first sheet of an .xlsx workbook, as CSV text the contact importer
 * already understands.
 *
 * Deliberately small: an .xlsx is a zip of XML, and a contact list needs cell
 * values, not formatting, formulas or dates. Reading it here — rather than
 * asking people to "Save as CSV" first — is the difference between an upload
 * that works from the file they have and one that sends them to a help page.
 * Legacy .xls (binary) is not supported.
 */
export function xlsxToCsv(data: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new Error("This isn't a readable .xlsx file")
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null)

  const sheetPath = firstSheetPath(text("xl/workbook.xml"), text("xl/_rels/workbook.xml.rels"), files)
  const sheet = sheetPath ? text(sheetPath) : null
  if (!sheet) throw new Error("The workbook has no sheets")

  const shared = sharedStrings(text("xl/sharedStrings.xml"))
  const rows: string[][] = []
  // `<row r="5"/>` is an empty row; without the `\/>` branch the lazy match ran
  // on to the next row's closing tag and swallowed that row.
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attr(rowMatch[1], "r")) || rows.length + 1
    const cells: string[] = []
    let nextCol = 0
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1]
      const ref = attr(attrs, "r")
      const col = ref ? columnIndex(ref) : nextCol
      nextCol = col + 1
      cells[col] = cellValue(attrs, cellMatch[2] ?? "", shared)
    }
    // Empty rows are skipped in the XML; keep the gap so line numbers match
    // what the spreadsheet shows.
    while (rows.length < rowNumber - 1) rows.push([])
    rows.push(Array.from(cells, (c) => c ?? ""))
  }
  const width = Math.max(0, ...rows.map((r) => r.length))
  return rows
    .map((r) => serializeCsvLine([...r, ...Array(width - r.length).fill("")]))
    .join("\n")
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return m ? m[1] : null
}

/** "C12" → 2 (zero-based column). */
export function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A"
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function decodeXml(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    switch (e.toLowerCase()) {
      case "lt":
        return "<"
      case "gt":
        return ">"
      case "amp":
        return "&"
      case "quot":
        return '"'
      case "apos":
        return "'"
    }
    return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  })
}

/** All `<t>` runs inside a node, joined — rich text splits one value into several. */
function textRuns(xml: string): string {
  let out = ""
  // Phonetic guides (<rPh>, Japanese furigana) carry their own <t> runs that
  // are not part of the value.
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
    out += decodeXml(m[1])
  }
  return out
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return []
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g), (m) => textRuns(m[1]))
}

function cellValue(attrs: string, inner: string, shared: string[]): string {
  const type = attr(attrs, "t")
  if (type === "inlineStr") return textRuns(inner)
  const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
  if (v == null) return ""
  if (type === "s") return shared[Number(v)] ?? ""
  if (type === "str" || type === "e") return decodeXml(v)
  if (type === "b") return v === "1" ? "TRUE" : "FALSE"
  // A phone number typed into a number cell can come back as 9.19876543210E+11.
  if (/e/i.test(v)) {
    const n = Number(v)
    if (Number.isSafeInteger(n)) return String(n)
  }
  return v
}

function firstSheetPath(
  workbook: string | null,
  rels: string | null,
  files: Record<string, Uint8Array>
): string | null {
  const rid = workbook?.match(/<sheet\b[^>]*?\br:id="([^"]+)"/)?.[1]
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      if (attr(m[1], "Id") !== rid) continue
      const target = attr(m[1], "Target") ?? ""
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`
      if (files[path]) return path
    }
  }
  return (
    Object.keys(files)
      .filter((p) => /^xl\/worksheets\/[^/]+\.xml$/.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0] ?? null
  )
}
