import type { SegmentCondition, SegmentRules } from "@/services/api"

/**
 * The campaign wizard's "by tags" audience: the tags you start from, and how
 * the other tags those people carry narrow it — "diwali-sale, but only vip and
 * not sent-2-oct". Compiles to the same rule shape a dynamic segment uses, so
 * the server evaluates it with the segment engine and nothing new.
 */
export type TagRefinement = "require" | "exclude"

export interface TagAudience {
  /** Starting tags. Empty means the audience isn't chosen yet. */
  include: string[]
  /** With more than one starting tag: anyone carrying one, or only people carrying all. */
  match: "any" | "all"
  /** Other tags, by name: people must also carry it, or must not. */
  refine: Record<string, TagRefinement>
}

export const EMPTY_TAG_AUDIENCE: TagAudience = { include: [], match: "any", refine: {} }

/** What the API takes: a lone tag stays `audienceTag`, anything richer is rules. */
export type TagAudienceSelector = { audienceTag: string } | { audienceRules: SegmentRules }

const hasTag = (value: string): SegmentCondition => ({ type: "tag", operator: "has", value })
const lacksTag = (value: string): SegmentCondition => ({ type: "tag", operator: "not_has", value })

/**
 * The server bounds rules at 20 members per group and 50 tag conditions in
 * all (segment-rules.ts). Members are chunked into nested groups to stay
 * under the first; the picker stops adding tags at the second.
 */
export const MAX_GROUP_MEMBERS = 20
export const MAX_FILTER_TAGS = 50

function chunk<T>(items: T[], size = MAX_GROUP_MEMBERS): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Tag conditions the audience compiles to — what MAX_FILTER_TAGS counts. */
export function filterTagCount(audience: TagAudience): number {
  return audience.include.length + activeRefinements(audience).length
}

/** Refinements that still mean something: a starting tag can't also be required or excluded. */
function activeRefinements(audience: TagAudience): [string, TagRefinement][] {
  return Object.entries(audience.refine).filter(([tag]) => !audience.include.includes(tag))
}

/** The starting tags only, before refinements — what "also tagged" is counted over. */
export function baseTagSelector(audience: TagAudience): TagAudienceSelector | null {
  return toSelector({ ...audience, refine: {} })
}

export function toSelector(audience: TagAudience): TagAudienceSelector | null {
  const include = audience.include
  if (include.length === 0) return null
  const refinements = activeRefinements(audience)
  // One tag, nothing else: the plain selector, which every older screen
  // (campaign detail, duplicate) already knows how to show.
  if (include.length === 1 && refinements.length === 0) return { audienceTag: include[0] }

  const combinator = audience.match === "all" ? "and" : "or"
  const includeChunks = chunk(include.map(hasTag))
  const start: SegmentCondition | SegmentRules =
    include.length === 1
      ? hasTag(include[0])
      : includeChunks.length === 1
        ? { type: "group", combinator, conditions: includeChunks[0] }
        : {
            type: "group",
            combinator,
            conditions: includeChunks.map((c): SegmentRules => ({ type: "group", combinator, conditions: c })),
          }
  const refs = refinements.map(([tag, how]) => (how === "require" ? hasTag(tag) : lacksTag(tag)))
  // start + refinements must fit one group; past that, refinements go in
  // and-groups of their own (still all required, so the meaning is unchanged).
  const rest: Array<SegmentCondition | SegmentRules> =
    refs.length + 1 <= MAX_GROUP_MEMBERS
      ? refs
      : chunk(refs).map((c): SegmentRules => ({ type: "group", combinator: "and", conditions: c }))
  return { audienceRules: { combinator: "and", conditions: [start, ...rest] } }
}

/** "vip or retail · also wholesale · not sent-2-oct" — for the review summary. */
export function describeTagAudience(audience: TagAudience): string {
  if (audience.include.length === 0) return "No tags picked"
  const joiner = audience.match === "all" ? " and " : " or "
  const parts = [audience.include.join(joiner)]
  const refinements = activeRefinements(audience)
  const required = refinements.filter(([, how]) => how === "require").map(([tag]) => tag)
  const excluded = refinements.filter(([, how]) => how === "exclude").map(([tag]) => tag)
  if (required.length) parts.push(`also ${required.join(", ")}`)
  if (excluded.length) parts.push(`not ${excluded.join(", ")}`)
  return parts.join(" · ")
}

/**
 * Reads a campaign's stored audience back into the picker (duplicate / follow
 * up). Only the shape `toSelector` writes is recognised; anything else returns
 * null and the caller falls back to "everyone".
 */
export function fromRules(rules: SegmentRules): TagAudience | null {
  if (rules.combinator !== "and" || rules.conditions.length === 0) return null
  const [start, ...rest] = rules.conditions
  let include: string[]
  let match: TagAudience["match"] = "any"
  if ("conditions" in start) {
    // One level of chunking, all with the same combinator — what toSelector writes.
    const members = start.conditions.flatMap((c) =>
      "conditions" in c && c.combinator === start.combinator ? c.conditions : [c]
    )
    if (!members.every(isHasTag)) return null
    include = members.map((c) => (c as { value: string }).value)
    match = start.combinator === "and" ? "all" : "any"
  } else if (isHasTag(start)) {
    include = [start.value]
  } else {
    return null
  }
  const refine: Record<string, TagRefinement> = {}
  const leaves = rest.flatMap((c) => ("conditions" in c && c.combinator === "and" ? c.conditions : [c]))
  for (const c of leaves) {
    if ("conditions" in c || c.type !== "tag") return null
    refine[c.value] = c.operator === "has" ? "require" : "exclude"
  }
  return { include, match, refine }
}

function isHasTag(
  c: SegmentCondition | SegmentRules
): c is Extract<SegmentCondition, { type: "tag" }> & { operator: "has" } {
  return !("conditions" in c) && c.type === "tag" && c.operator === "has"
}

/** A stored campaign's tag rules, in words — "a tag filter" if they aren't the wizard's shape. */
export function describeStoredRules(rules: SegmentRules): string {
  const audience = fromRules(rules)
  return audience ? describeTagAudience(audience) : "a tag filter"
}
