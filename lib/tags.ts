/**
 * Contact tags as the backend stores them: trimmed, lowercased, no duplicates.
 * Normalising here too means what the user sees in a tag box is exactly what
 * gets saved, instead of "VIP" turning into "vip" after the round trip.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

/**
 * Splits typed or pasted text into tags. Commas, semicolons, pipes and new
 * lines all separate, matching what CSV import accepts; a full stop does not,
 * because tags like "v2.0" are legitimate.
 */
export function splitTags(text: string): string[] {
  return text.split(/[,;|\n]/).map(normalizeTag).filter(Boolean)
}

/** Adds tags that aren't there yet, keeping the existing order. */
export function addTags(existing: string[], incoming: string[]): string[] {
  const out = [...existing]
  for (const tag of incoming.map(normalizeTag)) {
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

/** Existing tags that start with (then contain) what's being typed, minus those already chosen. */
export function suggestTags(query: string, known: string[], chosen: string[], limit = 6): string[] {
  const q = normalizeTag(query)
  const open = known.filter((t) => !chosen.includes(t))
  if (!q) return open.slice(0, limit)
  const starts = open.filter((t) => t.startsWith(q))
  const contains = open.filter((t) => !t.startsWith(q) && t.includes(q))
  return [...starts, ...contains].slice(0, limit)
}
