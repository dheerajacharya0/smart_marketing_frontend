/**
 * One date format for the whole product.
 *
 * Three coexisted: `toLocaleString()` with no options (`9/17/2026, 12:54:59 PM`
 * — seconds and all) on the campaign screens, `{ month: "short" }` on contacts
 * and segments, and a fourth variant inside `contact-consent.ts`. Nothing was
 * wrong with any one of them; having three is what made the product look
 * unfinished, because two timestamps a few pixels apart disagreed on shape.
 *
 * Locale stays `undefined` on purpose — field order is the viewer's business
 * ("17 Sep" or "Sep 17"), the *options* are ours. Seconds are never shown: a
 * campaign that started at 12:54:59 and finished at 12:55:00 reads as precision
 * nobody asked for, and the extra characters are what pushed the header line
 * into a run-on.
 */

const DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Placeholder for an absent date. Callers should not invent their own. */
export const NO_DATE = "—"

/** `17 Sep 2026`. */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso)
  return d ? d.toLocaleDateString(undefined, DATE) : NO_DATE
}

/** `17 Sep 2026, 12:54 PM`. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso)
  return d ? d.toLocaleString(undefined, { ...DATE, ...TIME }) : NO_DATE
}

/** `12:54 PM` — for a timestamp whose day is already established by context. */
export function formatTime(iso: string | null | undefined): string {
  const d = parse(iso)
  return d ? d.toLocaleTimeString(undefined, TIME) : NO_DATE
}
