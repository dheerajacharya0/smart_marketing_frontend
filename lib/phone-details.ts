/**
 * Meta's phone-number fields as label/value rows for onboarding step 2.
 *
 * The page used to print every field raw, so nested ones (`throughput`,
 * `webhook_configuration`) showed as "[object Object]" and the rest kept
 * Meta's snake_case keys. Known fields get a label and a readable value;
 * `throughput` reads as its level; other nested objects are left out (the
 * webhook URL is our own config, not something to show a customer here).
 */
const FIELDS: { key: string; label: string; format?: (value: unknown) => string | null }[] = [
  { key: "display_phone_number", label: "Number" },
  { key: "verified_name", label: "Display name" },
  { key: "code_verification_status", label: "Verification", format: (v) => humanize(v) },
  { key: "quality_rating", label: "Quality", format: (v) => humanize(v) },
  {
    key: "platform_type",
    label: "Platform",
    format: (v) => (v === "CLOUD_API" ? "Cloud API" : v === "NOT_APPLICABLE" ? "Not registered" : humanize(v)),
  },
  {
    key: "throughput",
    label: "Throughput",
    format: (v) => humanize(v && typeof v === "object" ? (v as { level?: unknown }).level : v),
  },
  { key: "last_onboarded_time", label: "Onboarded", format: (v) => formatDate(v) },
  { key: "id", label: "Phone number ID" },
]

const KNOWN = new Set(FIELDS.map((f) => f.key))

function humanize(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function formatDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  // Meta sends "2026-10-01T14:17:42+0000"; Date wants a colon in the offset.
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function plain(value: unknown): string | null {
  if (typeof value === "string") return value || null
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return null
}

export function phoneDetailRows(details: Record<string, unknown> | null | undefined): { label: string; value: string }[] {
  if (!details) return []
  const rows: { label: string; value: string }[] = []
  for (const field of FIELDS) {
    if (!(field.key in details)) continue
    const value = field.format ? field.format(details[field.key]) : plain(details[field.key])
    if (value) rows.push({ label: field.label, value })
  }
  // Fields Meta adds later still show, as long as they are plain values.
  for (const [key, raw] of Object.entries(details)) {
    if (KNOWN.has(key)) continue
    const value = plain(raw)
    if (value) rows.push({ label: humanize(key) ?? key, value })
  }
  return rows
}
