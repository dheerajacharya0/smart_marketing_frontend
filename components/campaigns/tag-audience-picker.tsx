"use client"

import { useMemo, useState } from "react"
import { Check, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { filterTagCount, MAX_FILTER_TAGS, type TagAudience, type TagRefinement } from "@/lib/audience-tags"
import type { ContactTag } from "@/services/api"

/** Tags listed before "Show all" — enough for a thumb, not a wall. */
const LIST_LIMIT = 12

/**
 * "Send to people tagged …", then narrow by the other tags those people carry.
 *
 * The second half is the follow-up tool: pick `diwali-leads`, see that 140 of
 * them also carry `sent-2-oct` from the last broadcast, and skip them in one
 * tap — or keep only the `vip` ones. Counts come from the server over the
 * starting tags, so they say how many of *this* audience carry each tag.
 *
 * Every control is a plain button: no popovers inside the dialog, which have
 * misbehaved on touch screens before.
 */
export function TagAudiencePicker({
  value,
  onChange,
  knownTags,
  breakdown,
  breakdownTotal,
  breakdownLoading,
}: {
  value: TagAudience
  onChange: (next: TagAudience) => void
  knownTags: ContactTag[]
  /** Tags carried by people matching the starting tags; null while unknown. */
  breakdown: { tag: string; count: number }[] | null
  /** People matching the starting tags (before refinements). */
  breakdownTotal: number | null
  breakdownLoading: boolean
}) {
  const [query, setQuery] = useState("")
  const [showAllTags, setShowAllTags] = useState(false)
  const [showAllOthers, setShowAllOthers] = useState(false)

  const include = value.include
  // The server caps one filter at MAX_FILTER_TAGS tags; past it, only
  // removing (or changing an existing choice) is allowed.
  const used = filterTagCount(value)
  const full = used >= MAX_FILTER_TAGS
  const toggleInclude = (tag: string) => {
    if (!include.includes(tag) && full) return
    const next = include.includes(tag) ? include.filter((t) => t !== tag) : [...include, tag]
    // A tag moved into the starting set can't also refine it.
    const refine = { ...value.refine }
    delete refine[tag]
    onChange({ ...value, include: next, refine })
  }

  const setRefinement = (tag: string, how: TagRefinement | null) => {
    if (how && !value.refine[tag] && full) return
    const refine = { ...value.refine }
    if (how) refine[tag] = how
    else delete refine[tag]
    onChange({ ...value, refine })
  }

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    return knownTags.filter((t) => !include.includes(t.tag) && (!q || t.tag.includes(q)))
  }, [knownTags, include, query])
  const visibleTags = showAllTags || query ? matching : matching.slice(0, LIST_LIMIT)

  // Other tags of this audience. A refinement whose tag fell out of the
  // breakdown (the starting tags changed) is still listed so it can be undone.
  const others = useMemo(() => {
    const rows = (breakdown ?? []).filter((t) => !include.includes(t.tag))
    for (const tag of Object.keys(value.refine)) {
      if (!include.includes(tag) && !rows.some((r) => r.tag === tag)) rows.push({ tag, count: 0 })
    }
    return rows
  }, [breakdown, include, value.refine])
  const visibleOthers = showAllOthers ? others : others.slice(0, LIST_LIMIT)
  const refinedCount = Object.keys(value.refine).filter((t) => !include.includes(t)).length

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Send to contacts tagged</p>
        {include.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {include.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary-soft/40 px-2 py-1 text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => toggleInclude(tag)}
                  className="-mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Pick one or more tags below.</p>
        )}

        {include.length > 1 && (
          <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="Match">
            {(["any", "all"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value.match === m}
                onClick={() => onChange({ ...value, match: m })}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  value.match === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "any" ? "Any of these tags" : "All of these tags"}
              </button>
            ))}
          </div>
        )}
      </div>

      {knownTags.length > 0 ? (
        <div className="space-y-2">
          {knownTags.length > LIST_LIMIT && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags"
                className="pl-8"
                aria-label="Search tags"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((t) => (
              <Button
                key={t.tag}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={full}
                onClick={() => toggleInclude(t.tag)}
              >
                {t.tag}
                <span className="ml-1 tabular-nums text-muted-foreground">{t.count}</span>
              </Button>
            ))}
            {visibleTags.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {query ? "No tag matches." : "Every tag is picked."}
              </span>
            )}
          </div>
          {!query && matching.length > LIST_LIMIT && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setShowAllTags((v) => !v)}
            >
              {showAllTags ? "Show fewer" : `Show all ${matching.length} tags`}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No tags yet. Upload contacts above and tag them, or tag people on the Contacts page.
        </p>
      )}

      {include.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">Narrow it down</p>
              <p className="text-xs text-muted-foreground">
                {breakdownTotal != null
                  ? `Of the ${breakdownTotal} people tagged above, this many also carry each tag. `
                  : ""}
                <span className="font-medium text-foreground">Only</span> keeps people with it;{" "}
                <span className="font-medium text-foreground">Skip</span> leaves them out — e.g. skip
                last send&apos;s label to follow up only the rest.
              </p>
            </div>
            {others.length > 0 && (
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    // Tags already chosen are switched to Skip; new ones only
                    // while there is room under the cap.
                    let room = MAX_FILTER_TAGS - used
                    const refine = { ...value.refine }
                    for (const o of others) {
                      if (refine[o.tag]) refine[o.tag] = "exclude"
                      else if (room > 0) {
                        refine[o.tag] = "exclude"
                        room--
                      }
                    }
                    onChange({ ...value, refine })
                  }}
                >
                  Skip all
                </Button>
                {refinedCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onChange({ ...value, refine: {} })}
                  >
                    Reset
                  </Button>
                )}
              </div>
            )}
          </div>

          {breakdownLoading && breakdown == null ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking at their other tags...
            </p>
          ) : others.length === 0 ? (
            <p className="text-xs text-muted-foreground">These people carry no other tags.</p>
          ) : (
            <ul className="divide-y">
              {visibleOthers.map((o) => {
                const how = value.refine[o.tag] ?? null
                return (
                  <li key={o.tag} className="flex items-center gap-2 py-1.5">
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        how === "exclude" && "text-muted-foreground line-through"
                      )}
                      title={o.tag}
                    >
                      {o.tag}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{o.count}</span>
                    <div className="flex shrink-0 gap-1">
                      <RefineButton
                        active={how === "require"}
                        disabled={full && !how}
                        onClick={() => setRefinement(o.tag, how === "require" ? null : "require")}
                        label={`Only people tagged ${o.tag}`}
                      >
                        Only
                      </RefineButton>
                      <RefineButton
                        active={how === "exclude"}
                        disabled={full && !how}
                        destructive
                        onClick={() => setRefinement(o.tag, how === "exclude" ? null : "exclude")}
                        label={`Skip people tagged ${o.tag}`}
                      >
                        Skip
                      </RefineButton>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {full && (
            <p className="text-xs text-muted-foreground">
              One filter can use up to {MAX_FILTER_TAGS} tags. Remove one to add another, or save this
              audience as a segment.
            </p>
          )}
          {others.length > LIST_LIMIT && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setShowAllOthers((v) => !v)}
            >
              {showAllOthers ? "Show fewer" : `Show all ${others.length}`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function RefineButton({
  active,
  disabled,
  destructive,
  onClick,
  label,
  children,
}: {
  active: boolean
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "inline-flex h-8 min-w-14 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        active
          ? destructive
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  )
}
