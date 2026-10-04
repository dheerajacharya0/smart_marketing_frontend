/**
 * Just enough CSV for the contact importer: preview a file, fix its numbers,
 * stamp tags on every row, and write it back. The backend does the
 * authoritative parse — this only has to round-trip what it reads, and always
 * hands the backend comma-separated text.
 */

/** One line, with quoted fields holding commas or doubled quotes. */
export function parseCsvLine(line: string, delimiter = ","): string[] {
  return parseCsvRows(line, delimiter)[0] ?? [""]
}

/**
 * The whole file, quote-aware: a quoted field may hold the delimiter, a
 * doubled quote, or a line break (an address typed over two lines in Excel).
 * Splitting on newlines first broke such a row in two and the halves were
 * written back as separate contacts.
 */
export function parseCsvRows(text: string, delimiter = ","): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += ch
    }
  }
  row.push(field)
  rows.push(row)
  return rows
}

/** Inverse of `parseCsvLine` — quotes only the fields that need it. */
export function serializeCsvLine(fields: string[]): string {
  return fields
    .map((field) => (/[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field))
    .join(",")
}

/**
 * Comma, semicolon or tab — whichever the header line uses most outside
 * quotes. Excel in much of Europe saves "CSV" with semicolons, and a file
 * read with the wrong one is a single column with no phone in it.
 */
export function detectDelimiter(text: string): string {
  const end = text.search(/\r?\n/)
  const firstLine = end === -1 ? text : text.slice(0, end)
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 }
  let inQuotes = false
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return count > 0 ? best : ","
}

/** Header names the backend accepts for the number column, lower-cased. */
export const PHONE_HEADERS = ["phone", "waid", "wa_id", "number", "whatsapp"]

/** Header names the backend accepts for the tags column. */
export const TAG_HEADERS = ["tags", "tag"]

export interface ParsedCsv {
  header: string[]
  rows: string[][]
  /** Index of the number column, or -1 when the file names none. */
  phoneIndex: number
}

const headerKey = (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_")

export function parseCsv(text: string): ParsedCsv {
  // A byte-order mark (Excel's "CSV UTF-8") would otherwise stick to the
  // first header and be written back into it.
  const clean = text.replace(/^﻿/, "").replace(/^(\r?\n)+/, "").replace(/(\r?\n)+$/, "")
  if (!clean) return { header: [], rows: [], phoneIndex: -1 }
  const [header, ...rows] = parseCsvRows(clean, detectDelimiter(clean))
  const phoneIndex = header.findIndex((h) => PHONE_HEADERS.includes(headerKey(h)))
  return { header, rows, phoneIndex }
}

/**
 * Every row gets `tags` added to whatever its own tags column already says —
 * the import merges tags into an existing contact, so this labels the upload
 * without taking anything off the people already in the account.
 */
export function withTags(parsed: ParsedCsv, tags: string[]): ParsedCsv {
  if (tags.length === 0) return parsed
  let tagIndex = parsed.header.findIndex((h) => TAG_HEADERS.includes(headerKey(h)))
  const header = [...parsed.header]
  if (tagIndex === -1) {
    tagIndex = header.length
    header.push("tags")
  }
  const rows = parsed.rows.map((row) => {
    const next = [...row]
    while (next.length < header.length) next.push("")
    const own = (next[tagIndex] ?? "")
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean)
    next[tagIndex] = [...new Set([...own, ...tags])].join(";")
    return next
  })
  return { ...parsed, header, rows }
}

export function toCsv(parsed: Pick<ParsedCsv, "header" | "rows">): string {
  return [parsed.header, ...parsed.rows].map(serializeCsvLine).join("\n")
}
