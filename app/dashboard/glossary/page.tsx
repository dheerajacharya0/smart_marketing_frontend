"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/page-header"
import { CATEGORY_LABELS, GLOSSARY, type GlossaryEntry } from "@/lib/glossary"

/**
 * Glossary — every Meta/WhatsApp term the app shows, in plain language.
 *
 * The same entries back the inline `<Explain>` tooltips (`lib/glossary.ts`), so
 * a definition can only be written once. Entry ids double as anchor ids, which
 * is what lets anything deep-link to a single term (`/dashboard/glossary#waba`).
 *
 * The search box filters the list on the client and genuinely works — unlike the
 * ornamental "Search documentation" input that was deleted from /dashboard/docs.
 */

const CATEGORY_ORDER = ["setup", "sending", "audience", "billing", "automation"] as const

function matches(entry: GlossaryEntry, query: string): boolean {
  const haystack = [entry.term, entry.short, entry.long ?? "", ...(entry.aliases ?? [])]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

export default function GlossaryPage() {
  const [query, setQuery] = useState("")

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const entries = needle ? GLOSSARY.filter((entry) => matches(entry, needle)) : GLOSSARY
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: entries.filter((entry) => entry.category === category),
    })).filter((group) => group.entries.length > 0)
  }, [query])

  const total = grouped.reduce((sum, group) => sum + group.entries.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard/docs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to documentation
          </Link>
        </Button>
        <PageHeader
          title="Glossary"
          description="What WhatsApp and Meta's terms actually mean, in plain language."
        />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search terms — try 'limit' or 'template'"
          className="pl-9"
          aria-label="Search glossary"
        />
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No term matches &ldquo;{query.trim()}&rdquo;.
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.category}>
            <CardHeader>
              <CardTitle>{CATEGORY_LABELS[group.category]}</CardTitle>
              <CardDescription>
                {group.entries.length} term{group.entries.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {group.entries.map((entry) => (
                // id doubles as the deep-link anchor; scroll-mt keeps the
                // heading clear of the sticky dashboard header.
                <div key={entry.id} id={entry.id} className="scroll-mt-24 border-b pb-6 last:border-0 last:pb-0">
                  <h3 className="font-medium">{entry.term}</h3>
                  {entry.aliases && entry.aliases.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Also called: {entry.aliases.join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-sm">{entry.short}</p>
                  {entry.long && (
                    <p className="mt-2 text-sm text-muted-foreground">{entry.long}</p>
                  )}
                  {entry.learnMore && (
                    // rel="noopener noreferrer" per the Phase S #5 convention.
                    <a
                      href={entry.learnMore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm font-medium text-primary underline underline-offset-4"
                    >
                      Meta&apos;s documentation
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
