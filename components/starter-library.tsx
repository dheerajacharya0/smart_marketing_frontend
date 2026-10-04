"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * "Start from a template" picker, shared by the segments and flows lists.
 *
 * Both features previously opened onto an empty builder, which is the point
 * where a non-technical user stalls: they have to invent the thing before the
 * tool helps them make it. Each card deep-links to the builder with
 * `?starter=<id>`, which pre-fills a complete, valid draft they can preview,
 * edit and save — or abandon, since nothing is written until they press save.
 *
 * Rendered above the list, not instead of it, so an established account still
 * reaches its own items first-thing without the picker getting in the way.
 */

export interface StarterOption {
  id: string
  label: string
  blurb: string
}

export function StarterLibrary({
  title,
  description,
  basePath,
  options,
  disabled = false,
  disabledReason,
  toolbar,
}: {
  title: string
  description: string
  /** Builder route the cards link to, e.g. "/dashboard/segments/new". */
  basePath: string
  options: readonly StarterOption[]
  /** No account/number resolved yet — cards render inert rather than 404ing. */
  disabled?: boolean
  /** Hover text explaining the inert state — "no account" vs "lookup failed". */
  disabledReason?: string
  /** Controls above the cards, e.g. an industry filter. */
  toolbar?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {toolbar}
        {/* One scrolling row rather than a grid. Stacked in a narrow column the
            cards turned into a tall wall of paragraphs that pushed the actual
            list below the fold; a strip keeps them one glance wide at every
            width and scrolls sideways when they don't fit. */}
        {/* Keyed on the options: a filtered list starts scrolled to its first
            card, not wherever the previous list was left. */}
        <div
          key={options.map((o) => o.id).join("|")}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
        >
          {options.map((option) => {
            const body = (
              <>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.blurb}</p>
              </>
            )
            const shape = "w-60 shrink-0 snap-start rounded-md border bg-background p-3"
            return disabled ? (
              <div
                key={option.id}
                className={`${shape} cursor-not-allowed opacity-50`}
                aria-disabled
                title={disabledReason}
              >
                {body}
              </div>
            ) : (
              <Link
                key={option.id}
                href={`${basePath}?starter=${encodeURIComponent(option.id)}`}
                className={`${shape} transition-colors hover:border-foreground/20 hover:bg-accent/40`}
              >
                {body}
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
