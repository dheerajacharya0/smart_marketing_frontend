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
}: {
  title: string
  description: string
  /** Builder route the cards link to, e.g. "/dashboard/segments/new". */
  basePath: string
  options: readonly StarterOption[]
  /** No account/number resolved yet — cards render inert rather than 404ing. */
  disabled?: boolean
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
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => {
            const body = (
              <>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.blurb}</p>
              </>
            )
            return disabled ? (
              <div
                key={option.id}
                className="cursor-not-allowed rounded-md border bg-background p-3 opacity-50"
                aria-disabled
              >
                {body}
              </div>
            ) : (
              <Link
                key={option.id}
                href={`${basePath}?starter=${encodeURIComponent(option.id)}`}
                className="rounded-md border bg-background p-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
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
